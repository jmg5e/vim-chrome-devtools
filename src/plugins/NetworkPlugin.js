// @flow

import { type Chrome, type Script } from 'chrome-remote-interface';
import { type NeovimPlugin, type NeovimClient } from 'neovim';

const REQUEST_QUEUE_MAX_SIZE = 5;

export default class NetworkPlugin {
  _nvim: NeovimClient;
  _chrome: Chrome;

  constructor(plugin: NeovimPlugin) {
    this._nvim = plugin.nvim;
    this._requests = [];
    this._responses = [];

    plugin.registerCommand(
      'ChromeDevToolsSelectRequest',
      async (args: string[]) => {
        const index = args[0];
        const { response } = this._responses[index] || {};
        const { request } = this._requests[index] || {};
        const output = JSON.stringify({ request, response });
        await this._nvim.command('silent belowright vs request.json');
        await this._nvim.command(
          'setlocal ft=json noswapfile nonumber bufhidden=delete nobuflisted',
        );
        // buftype=nofile bufhidden=wipe
        // await this._nvim.command(
        //   'setlocal buftype=nofile bufhidden=wipe nobuflisted noswapfile nonumber ft=json',
        // );
        const buf = await this._nvim.buffer;
        if (buf) {
          await buf.replace([output], 0);
        } else {
          console.error('no buffer');
        }
      },
      {
        nargs: '*',
      },
    );
  }
  startNetworkMonitor = chrome => {
    console.log('started network monitor');
    this._chrome = chrome;
    this._chrome.Network.requestWillBeSent(request => {
      this._requests.push(request);
      if (this._requests.length >= REQUEST_QUEUE_MAX_SIZE) {
        this._requests.shift();
      }
    });
    this._chrome.Network.responseReceived(response => {
      this._responses.push(response);

      if (this._responses.length >= REQUEST_QUEUE_MAX_SIZE) {
        this._responses.shift();
      }
    });
  };

  listRequests = async () => {
    const labels = this._requests.map(
      ({ request: { url, method }, requestId }, index) =>
        `${index} ${method}-${url} ${requestId}`,
    );
    await this._nvim.call('fzf#run', {
      down: '40%',
      sink: 'ChromeDevToolsSelectRequest',
      source: labels,
    });
  };
}
