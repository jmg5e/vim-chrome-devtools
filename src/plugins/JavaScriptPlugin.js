// @flow

import { type Chrome, type Script } from 'chrome-remote-interface';
import { type NeovimPlugin, type NeovimClient } from 'neovim';

import { getVisualSelection } from '../utils';
import { echoerr } from '../echo';

export default class JavaScriptPlugin {
  _nvim: NeovimClient;
  _chrome: Chrome;

  constructor(plugin: NeovimPlugin) {
    this._nvim = plugin.nvim;

    plugin.registerFunction(
      'ChromeDevTools_Runtime_evaluate',
      this.runtimeEvaluate,
      { range: true },
    );
  }

  runtimeEvaluate = async (args: string[]) => {
    const expression =
      args.length > 0 ? args[0] : await getVisualSelection(this._nvim);

    const { exceptionDetails, result } = await this._chrome.Runtime.evaluate({
      expression,
      generatePreview: true,
    });

    if (exceptionDetails) {
      echoerr(this._nvim, `Failed with message: ${exceptionDetails.text}`);
      return;
    }
    if (result && result.value) {
      return this._nvim.setLine(JSON.stringify(result.value));
    }
  };
}
