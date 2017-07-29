'use struct';

import http from 'http';
import createHandler from 'github-webhook-handler';
import config from 'config';
import Promise from 'bluebird';
import PullRequest from './lib/pull_request';
import Slack from './lib/slack';

const PORT = process.env.PORT || 8080;
const SECRET_TOKEN = process.env.SECRET_TOKEN || '';
const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN || '';
const SLACK_API_TOKEN = process.env.SLACK_API_TOKEN || '';

const options = {
  debug: true,
  protocol: 'https',
  host: 'api.github.com',
  pathPrefix: '',
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

if (config.pathPrefix) {
  options.pathPrefix = config.pathPrefix;
}

const handler = createHandler({
  path: '/',
  secret: SECRET_TOKEN,
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

handler.on('pull_request', async (event) => {
  try {
    const payload = event.payload;
    const action = payload.action;
    const number = payload.number;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const url = payload.pull_request.html_url;

    if (config.repositories.indexOf(repo) !== -1 && action === 'opened') {
      const pr = new PullRequest(options, GITHUB_API_TOKEN);
      await pr.requestReview(owner, repo, number, config.reviewers);
      await pr.assignReviewers(owner, repo, number, config.reviewers);

      if (config.requestReview === true || config.assignReviewers === true) {
        const slack = new Slack(SLACK_API_TOKEN);
        config.reviewers.forEach(async (reviewer) => {
          await slack.postMessage(config.slackUsers[`${reviewer}`], url, config.message.requestReview);
        });
      }
    }
  } catch (error) {
    console.log(error);
  }
});

handler.on('pull_request_review', async (event) => {
  try {
    const payload = event.payload;
    const number = payload.pull_request.number;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const user = payload.pull_request.user.login;
    const url = payload.pull_request.html_url;

    const slack = new Slack(SLACK_API_TOKEN);

    if (config.ableToMerge) {
      const pr = new PullRequest(options, GITHUB_API_TOKEN);
      const comments = await pr.getApproveComments(owner, repo, number, config.approveComments);

      if (config.repositories.indexOf(repo) !== -1 && comments.length >= config.numApprovers) {
        await slack.postMessage(config.slackUsers[`${user}`], url, config.message.ableToMerge);
      }
    }

    if (config.mentionComment) {
      const comment = PullRequest.parseMentionComment(payload.review.body, payload.review.html_url);

      if (comment.hasOwnProperty('mentionUsers')) {
        comment.mentionUsers.forEach(async (mentionUser) => {
          await slack.postMessage(config.slackUsers[`${mentionUser}`], comment.url, config.message.mentionComment);
        });
      }
    }
  } catch (error) {
    console.log(error);
  }
});
