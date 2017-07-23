'use struct';

import { WebClient } from '@slack/client';

const token = process.env.SLACK_API_TOKEN || '';

export default async function postMessage(user, url, message) {
  try {
    const web = new WebClient(token);
    const channel = `%40${user}`;
    const text = `${url}\n${message}`;
    web.chat.postMessage(token, channel, text);
  } catch (error) {
    throw new Error(error.message);
  }
}
