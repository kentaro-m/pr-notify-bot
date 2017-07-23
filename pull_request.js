'use struct';

import GitHubApi from 'github';

export default class PullRequest {
  constructor(options, token) {
    this.github = new GitHubApi(options);
    this.github.authenticate({
      type: 'oauth',
      token,
    });
  }

  async addReviewers(owner, repo, number, reviewers) {
    try {
      await this.github.pullRequests.createReviewRequest({
        owner,
        repo,
        number,
        reviewers,
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getApproveComments(owner, repo, number, approveComments) {
    try {
      const comments = await this.github.pullRequests.getComments({
        owner,
        repo,
        number,
        approveComments,
      });

      const results = comments.filter((comment, index) => {
        approveComments.forEach((approveComment) => {
          if (comment.body === approveComment) return true;
        });
      });

      return results;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
