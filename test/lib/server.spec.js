import sinon from 'sinon';
import { assert } from 'chai';

import readFixtures from '../../test/utils/fixtures';
import PullRequest from '../../lib/pull_request';
import Slack from '../../lib/slack';
import { handlePullRequest, handlePullRequestReview, server } from '../../server';

/* global describe, it, beforeEach, afterEach */

describe('Index', () => {
  let sandbox;
  let env;
  let event;

  beforeEach(() => {
    process.env.SECRET_TOKEN = 'secret token';
    process.env.SLACK_API_TOKEN = 'slack api token';
    process.env.GITHUB_API_TOKEN = 'github api token';
    env = Object.assign({}, process.env);
    sandbox = sinon.createSandbox();
    sandbox.stub(Slack.prototype, 'postMessage').returns(Promise.resolve({}));
  });

  afterEach(() => {
    process.env = env;
    server.close();
    sandbox.restore();
  });

  describe('handlePullRequest', () => {
    it('can send a review request message to reviewers using Slack', async () => {
      sandbox.stub(PullRequest.prototype, 'requestReview').returns(Promise.resolve({}));
      sandbox.stub(PullRequest.prototype, 'assignReviewers').returns(Promise.resolve({}));
      event = readFixtures('test/fixtures/request_review.json');
      const response = await handlePullRequest(event);
      assert.equal(response, undefined);
    });
  });

  describe('handlePullRequestReview', () => {
    it('can send a able merge message to the author using Slack', async () => {
      const reviewComments = readFixtures('test/fixtures/review_comments_approved.json');
      sandbox.stub(PullRequest.prototype, 'getReviewComments').returns(Promise.resolve(reviewComments));
      event = readFixtures('test/fixtures/merge.json');
      const response = await handlePullRequestReview(event);
      assert.equal(response, undefined);
    });

    it('can send a mention message to a member using Slack', async () => {
      const reviewComments = readFixtures('test/fixtures/review_comments_changed.json');
      sandbox.stub(PullRequest.prototype, 'getReviewComments').returns(Promise.resolve(reviewComments));
      event = readFixtures('test/fixtures/mention.json');
      const response = await handlePullRequestReview(event);
      assert.equal(response, undefined);
    });
  });
});
