// this class is purely written by LLM (model used: Gemini 3)
// sorry, i'm not good at designing stuff...
// i have minified some parts in the class
const document = window.document;

// i will keep the code below as original as possible, and what the LLM writes
// but i have updated it a bit and added methods to avoid other event listeners
// from interupting the input
/*
 * Highly-Optimized Mobile Command Terminal Component (With .debug and .table)
 * Contributed by Gemini (Google AI) via prompt assistance.
 * Licensed under the GNU General Public License v3 (GPLv3).
 */
export class DropInConsole {
  constructor(commandHandler) {
    this.isOpen = false;
    this.commandHandler = commandHandler || ((cmd) => this.printLevel('error', `No handler: ${cmd}`));
    this._buildUI();
  }

  _buildUI() {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    const shadow = host.attachShadow({ mode: 'open' });

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;bottom:0;left:0;width:100vw;height:50vh;background:#111;color:#fff;font-family:monospace;font-size:13px;box-shadow:0 -5px 15px rgba(0,0,0,0.5);display:flex;flex-direction:column;transform:translateY(100%);transition:transform 0.2s ease-in-out;box-sizing:border-box;';

    const header = document.createElement('div');
    header.style.cssText = 'background:#222;padding:8px 12px;display:flex;justify-content:space-between;border-bottom:1px solid #333;align-items:center;';
    
    const title = document.createElement('span');
    title.style.cssText = 'color:#aaa;font-weight:bold;';
    title.textContent = '🛠️ Framework Terminal';
    
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:#f55;cursor:pointer;font-weight:bold;font-size:14px;padding:4px;';
    closeBtn.textContent = '✕ Close';
    closeBtn.addEventListener('click', () => this.toggle());

    header.appendChild(title);
    header.appendChild(closeBtn);
    
    this.output = document.createElement('div');
    this.output.style.cssText = 'flex:1;overflow-y:auto;padding:0;white-space:pre;line-height:1.4;';

    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'background:#1a1a1a;padding:8px;border-top:1px solid #333;display:flex;align-items:center;';
    
    this.inputField = document.createElement('input');
    this.inputField.type = 'text';
    this.inputField.placeholder = 'Type framework command...';
    this.inputField.style.cssText = 'flex:1;background:#252525;border:1px solid #444;color:#0f0;font-family:monospace;font-size:14px;padding:8px 10px;border-radius:4px;outline:none;';
    this.inputField.addEventListener('keydown', (e) => {
      // avoid page from capturing request
      e.stopPropagation();
      e.stopImmediatePropagation();

      // normal input
      if (e.key === 'Enter' && this.inputField.value) {
        const cmd = this.inputField.value.trim();
        if (cmd) {
          this.printLevel('log', `> ${cmd}`);
          this.commandHandler(cmd);
          this.inputField.value = '';
        }
      }
    }, { capture: true });

    // blocking events from leaking out
    ["input", "keyup", "change"].forEach((event) => {
      this.inputField.addEventListener(event, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, { capture: true })
    })

    inputContainer.appendChild(this.inputField);
    container.appendChild(header);
    container.appendChild(this.output);
    container.appendChild(inputContainer);
    shadow.appendChild(container);
    
    // add the host to body
    // i don't know a better way that can avoid race condition
    let is_added = false;
    const append_host = () => {
      if (is_added || !document.body) return;
      document.body.appendChild(host);
      is_added = true;
    }
    
    if (document.body) {
      append_host();
    } else {
      const _obs = new MutationObserver((mutations, obs) => {
        if (document.body) {
          append_host();
          obs.disconnect();
        }
      })

      _obs.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      window.addEventListener("DOMContentLoaded", () => {
        if (document.body)
          append_host();
        _obs.disconnect();
      })
    }

    this.panel = container;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.panel.style.transform = this.isOpen ? 'translateY(0)' : 'translateY(100%)';
    if (this.isOpen) {
      setTimeout(() => this.inputField.focus(), 250);
    } else {
      this.inputField.blur();
    }
  }

  log(...args) { this.printLevel('log', ...args); }
  warn(...args) { this.printLevel('warn', ...args); }
  error(...args) { this.printLevel('error', ...args); }
  debug(...args) { this.printLevel('debug', ...args); } // Added .debug level
  table(data) { this.printLevel('log', data); }

  printLevel(level, ...args) {
    const len = args.length;
    if (len === 0) return;

    const line = document.createElement('div');
    line.style.cssText = 'padding:6px 10px;border-bottom:1px solid #222;display:block;';

    // Distinct background styles depending on log importance
    if (level === 'error') {
      line.style.cssText += 'background-color:rgba(255,85,85,0.12);color:#ff6b6b;border-left:3px solid #ff5555;';
    } else if (level === 'warn') {
      line.style.cssText += 'background-color:rgba(255,180,84,0.1);color:#ffb454;border-left:3px solid #ffb454;';
    } else if (level === 'debug') {
      line.style.cssText += 'color:#7ec0ee;'; // Styled light blue-grey text for debug traces
    }

    const fragment = document.createDocumentFragment();

    const timeSpan = document.createElement('span');
    timeSpan.style.cssText = 'color:#555;margin-right:5px;';
    timeSpan.textContent = `[${new Date().toLocaleTimeString()}]`;
    fragment.appendChild(timeSpan);

    const firstArg = args[0];

    if (typeof firstArg === 'string' && firstArg.includes('%c')) {
      const parts = firstArg.split('%c');
      const partsLen = parts.length;
      
      if (partsLen > 0) {
        const initialSpan = document.createElement('span');
        initialSpan.textContent = parts[0];
        fragment.appendChild(initialSpan);
      }

      let styleIdx = 1;
      for (let i = 1; i < partsLen; i++) {
        const span = document.createElement('span');
        span.textContent = parts[i];
        
        const styleVal = args[styleIdx];
        if (typeof styleVal === 'string') {
          span.style.cssText = styleVal;
          styleIdx++;
        }
        fragment.appendChild(span);
      }

      for (let i = styleIdx; i < len; i++) {
        fragment.appendChild(document.createTextNode(' '));
        fragment.appendChild(this._renderItem(args[i]));
      }
    } else {
      for (let i = 0; i < len; i++) {
        if (i > 0) fragment.appendChild(document.createTextNode(' '));
        fragment.appendChild(this._renderItem(args[i]));
      }
    }

    line.appendChild(fragment);
    this.output.appendChild(line);
    this.output.scrollTop = this.output.scrollHeight;
  }

  _renderItem(item) {
    const span = document.createElement('span');
    const type = typeof item;

    if (item === null) {
      span.textContent = 'null';
      span.style.color = '#777';
    } else if (item === undefined) {
      span.textContent = 'undefined';
      span.style.color = '#777';
    } else if (type === 'object') {
      if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'object' && item[0] !== null) {
        span.appendChild(this._createAsciiTable(item));
      } else {
        try {
          span.textContent = JSON.stringify(item);
          span.style.color = '#a8ff60';
        } catch (e) {
          span.textContent = String(item);
        }
      }
    } else if (type === 'number') {
      span.textContent = String(item);
      span.style.color = '#ffb454';
    } else if (type === 'boolean') {
      span.textContent = String(item);
      span.style.color = '#ff55f3';
    } else {
      span.textContent = String(item);
    }

    return span;
  }

  _createAsciiTable(arrayData) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'margin:5px 0;background:#1a1a1a;padding:6px;border-radius:4px;color:#55ffff;overflow-x:auto;white-space:pre;font-family:monospace;';
    try {
      const headers = ["(index)", ...new Set(arrayData.flatMap(obj => Object.keys(obj)))];
      const rows = arrayData.map((obj, index) => headers.map(header => header === "(index)" ? String(index) : String(obj[header] !== undefined ? obj[header] : '')));
      const colWidths = headers.map((header, colIdx) => Math.max(header.length, ...rows.map(row => row[colIdx].length)));
      const makeDivider = () => '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '\n';
      const makeRowStr = (cells) => '| ' + cells.map((cell, idx) => cell.padEnd(colWidths[idx])).join(' | ') + ' |\n';

      let tableStr = makeDivider() + makeRowStr(headers) + makeDivider();
      const rLen = rows.length;
      for (let i = 0; i < rLen; i++) {
        tableStr += makeRowStr(rows[i]);
      }
      tableStr += makeDivider();
      pre.textContent = tableStr;
    } catch (err) {
      pre.textContent = `[Table Error: ${err.message}]`;
      pre.style.color = '#ff5555';
    }
    return pre;
  }
}