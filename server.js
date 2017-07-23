'use struct';

import http from 'http';
import createHandler from 'github-webhook-handler';
import config from 'config';
import PullRequest from './pull_request';
import { postMessage } from './slack';
import Promise from 'bluebird';

const PORT = process.env.PORT || 8080;
const SECRET = process.env.SECRET || '';
const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN || '';

const options = {
  debug: true,
  protocol: 'https',
  host: 'api.github.com',
  pathPrefix: '/api/v3',
  headers: {
    'user-agent': 'PR-Bot',
  },
  Promise,
  followRedirects: false,
  timeout: 5000,
};

if (config.host) {
  options.host = config.host;
}

const handler = createHandler({
  path: '/',
  secret: SECRET,
});

http.createServer((req, res) => {
  handler(req, res, () => {
    res.statusCode = 404;
    res.end('no such location');
  });
}).listen(PORT);

console.log(`Server running at Port ${PORT}`);

handler.on('error', (err) => {
  console.error('Error:', err.message);
});

handler.on('pull_request', (event) => {
  const payload = event.payload;
  const action = payload.action;
  const number = payload.number;
  const repo = payload.repository.name;
  const owner = payload.repository.owner.login;
  const url = payload.pull_request.html_url;

  if (config.repositories.indexOf(repo) !== -1 && action === 'opened') {
    const pr = new PullRequest(options, GITHUB_API_TOKEN);
    // オートアサイン
    pr.addReviewers(owner, repo, number, config.reviewers);
    // Slack通知
    config.reviewers.forEach((reviewer) => {
      postMessage(reviewer, url, config.message.requestReview);
    });
  }
});

handler.on('pull_request_review_comment', (event) => {
  const payload = event.payload;
  const number = payload.number;
  const repo = payload.pull_request.repo.name;
  const owner = payload.pull_request.repo.owner.login;
  const user = payload.pull_request.user.login;
  const url = payload.pull_request.html_url;

  const pr = new PullRequest(options, GITHUB_API_TOKEN);
  const comments = pr.getApproveComments(owner, repo, number, config.approveComments);

  if (config.repositories.indexOf(repo) !== -1 && comments.length >= config.numApprovers) {
    // Slackで通知
    postMessage(user, url, config.message.ableToMerge);
  }
});
