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

export const handler = createHandler({
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
    console.log(payload);
    const action = payload.action;
    const number = payload.number;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const author = payload.pull_request.user.login;

    if (action === 'opened') {
      const reviewers = config.reviewers.filter((reviewer) => {
        return author !== reviewer;
      });

      const pr = new PullRequest(options, GITHUB_API_TOKEN);

      if (config.requestReview) {
        await pr.requestReview(owner, repo, number, reviewers);
      }

      if (config.assignReviewers) {
        await pr.assignReviewers(owner, repo, number, reviewers);
      }

      if (config.requestReview === true || config.assignReviewers === true) {
        const slack = new Slack(SLACK_API_TOKEN);
        reviewers.forEach(async (reviewer) => {
          const message = Slack.buildMessage(payload, config.message.requestReview, 'requestReview');
          await slack.postMessage(config.slackUsers[`${reviewer}`], message);
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

    const slack = new Slack(SLACK_API_TOKEN);

    if (config.ableToMerge) {
      const pr = new PullRequest(options, GITHUB_API_TOKEN);
      const reviewComments = await pr.getReviewComments(owner, repo, number);
      const approveComments = PullRequest.getApproveComments(reviewComments, config.approveComments);

      if (approveComments.length >= config.numApprovers) {
        const message = Slack.buildMessage(payload, config.message.ableToMerge, 'ableToMerge');
        await slack.postMessage(config.slackUsers[`${user}`], message);
      }
    }

    if (config.mentionComment) {
      const comment = PullRequest.parseMentionComment(payload.review.body);
      if (comment.hasOwnProperty('mentionUsers')) {
        comment.mentionUsers.forEach(async (mentionUser) => {
          const message = Slack.buildMessage(payload, config.message.mentionComment, 'mentionComment');
          await slack.postMessage(config.slackUsers[`${mentionUser}`], message);
        });
      }
    }
  } catch (error) {
    console.log(error);
  }
});
