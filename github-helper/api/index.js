require('dotenv').config();
const express = require('express');
const { Octokit } = require('octokit');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: '*', // Allow all origins in development. In production, specify your allowed origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Initialize Octokit with GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serve the branches visual UI
app.get('/branches', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'branches.html'));
});

// Get user's repositories
app.get('/repos', async (req, res) => {
  try {
    console.log('Fetching repositories...');
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100
    });
    console.log(`Found ${data.length} repositories`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories', details: error.message });
  }
});

// Get repository branches with Vercel deployment URLs
app.get('/repos/:owner/:repo/branches', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    console.log(`Fetching branches for ${owner}/${repo}...`);
    
    // Fetch branches from GitHub
    const { data: branches } = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100
    });

    // For each branch, fetch commit parents
    const branchesWithParents = await Promise.all(
      branches.map(async branch => {
        const commitData = await octokit.rest.git.getCommit({
          owner,
          repo,
          commit_sha: branch.commit.sha,
        });
        return {
          ...branch,
          parents: commitData.data.parents.map(p => p.sha),
        };
      })
    );

    console.log('branches with parents:', branchesWithParents);

    // Fetch Vercel deployments if Vercel token is available
    if (process.env.VERCEL_TOKEN) {
      try {
        // Log Vercel configuration (without exposing sensitive data)
        console.log('Vercel configuration:', {
          hasToken: !!process.env.VERCEL_TOKEN,
          projectId: process.env.VERCEL_PROJECT_ID,
          teamId: process.env.VERCEL_TEAM_ID,
          tokenLength: process.env.VERCEL_TOKEN.length
        });

        // Build query parameters
        const queryParams = new URLSearchParams({
          projectId: process.env.VERCEL_PROJECT_ID,
          limit: 100
        });

        // Add teamId if available
        if (process.env.VERCEL_TEAM_ID) {
          queryParams.append('teamId', process.env.VERCEL_TEAM_ID);
        }

        const vercelUrl = `https://api.vercel.com/v6/deployments?${queryParams.toString()}`;
        console.log('Fetching Vercel deployments from:', vercelUrl);

        const { data: vercelData } = await axios.get(vercelUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        console.log('Vercel deployments:', vercelData);

        // also show meta for each deployment
        vercelData.deployments.forEach(deployment => {
          console.log('Deployment Sha:', deployment.meta.githubCommitSha);
        });

        // Map deployment URLs to branches
        const branchesWithDeployments = branchesWithParents.map(branch => {
          const deployment = vercelData.deployments.find(d => d.meta?.githubCommitSha === branch.commit.sha);
          return {
            ...branch,
            deploymentUrl: deployment?.url
          };
        });

        console.log(`Found ${branchesWithDeployments.length} branches with deployments`);
        res.json(branchesWithDeployments);
        return;
      } catch (vercelError) {
        // Enhanced error logging
        console.error('Error fetching Vercel deployments:', {
          message: vercelError.message,
          status: vercelError.response?.status,
          statusText: vercelError.response?.statusText,
          data: vercelError.response?.data,
          headers: vercelError.response?.headers,
          config: {
            url: vercelError.config?.url,
            method: vercelError.config?.method,
            headers: vercelError.config?.headers
          }
        });

        // Continue with just GitHub branches if Vercel API fails
        console.log('Falling back to GitHub-only branch data');
      }
    } else {
      console.log('No Vercel token found, skipping Vercel deployment lookup');
    }

    console.log(`Found ${branchesWithParents.length} branches`);
    res.json(branchesWithParents);

  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Failed to fetch branches', details: error.message });
  }
});

// Get repository forks
app.get('/forks/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    // Extract query parameters with defaults
    const { sort = 'newest', per_page = 30, page = 1 } = req.query;

    // Validate per_page (GitHub max is 100)
    const validPerPage = Math.min(parseInt(per_page) || 30, 100);
    const validPage = parseInt(page) || 1;

    console.log(`Fetching forks for ${owner}/${repo} with params: sort=${sort}, per_page=${validPerPage}, page=${validPage}...`);
    
    const { data } = await octokit.rest.repos.listForks({
      owner,
      repo,
      sort: sort, // Valid values: newest, oldest, stargazers
      per_page: validPerPage,
      page: validPage
    });

    console.log(`Found ${data.length} forks for this page`);
    // Map the data to include only the desired fields
    const simplifiedForks = data.map(fork => ({
      full_name: fork.full_name,
      avatar_url: fork.owner.avatar_url,
      updated_at: fork.updated_at,
      html_url: fork.html_url,
      stargazers_count: fork.stargazers_count,
      pages_url: "https://" + fork.owner.login + ".github.io/" + fork.name
    }));

    console.log('simplifiedForks:', simplifiedForks);

    res.json(simplifiedForks);
  } catch (error) {
    console.error('Error fetching forks:', error);
    res.status(500).json({ error: 'Failed to fetch forks', details: error.message });
  }
});

// Create and push file to branch
app.post('/repos/:owner/:repo/push', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { branchName, content } = req.body;
    console.log(`Creating branch ${branchName} in ${owner}/${repo}...`);

    // Get the default branch's latest commit SHA
    const { data: defaultBranch } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: 'main' // or 'master' depending on the default branch
    });

    // Create a new branch
    const { data: newBranch } = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: defaultBranch.commit.sha
    });

    // Create the file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'index.html',
      message: `Create index.html in ${branchName}`,
      content: Buffer.from(content).toString('base64'),
      branch: branchName
    });

    console.log('Successfully created branch and pushed file');
    res.json({ success: true, branch: newBranch });
  } catch (error) {
    console.error('Error creating branch and pushing file:', error);
    res.status(500).json({ error: 'Failed to create branch and push file', details: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not Found', path: req.url });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Available routes:');
  console.log('GET /');
  console.log('GET /repos');
  console.log('GET /repos/:owner/:repo/branches');
  console.log('POST /repos/:owner/:repo/push');
  console.log('GET /forks/:owner/:repo');
}); 