const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const IPs = ['172.64.147.132', '172.64.144.253', '104.18.33.123'];

function createElement(tagName) {
  const listeners = new Map();
  return {
    tagName,
    children: [],
    className: '',
    value: '',
    textContent: '',
    readOnly: false,
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(child) {
      if (child.tagName === '#fragment') this.children.push(...child.children);
      else this.children.push(child);
      return child;
    },
    append(...children) { children.forEach((child) => this.appendChild(child)); },
    addEventListener(type, listener) { listeners.set(type, listener); },
    listener(type) { return listeners.get(type); },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    focus() {},
    select() {},
    querySelectorAll() { return []; },
  };
}

async function loadFrontend(relativePath) {
  const elements = new Map();
  [
    'generator-form', 'nodeLink', 'profile', 'submitBtn', 'fillDemoBtn', 'warningBox',
    'resultModal', 'nodeResults', 'closeModalBtn', 'closeModalFooterBtn', 'copyAllBtn',
    'statusLive', 'pageContent',
  ].forEach((id) => elements.set(id, createElement('div')));
  elements.get('profile').value = 'HZCT';

  const document = {
    activeElement: null,
    body: createElement('body'),
    getElementById(id) { return elements.get(id); },
    addEventListener() {},
    createElement,
    createDocumentFragment() { return createElement('#fragment'); },
    execCommand() { return true; },
  };
  function XMLHttpRequest() {
    this.open = () => {};
    this.send = () => {
      this.readyState = 4;
      this.status = 404;
      this.onreadystatechange();
    };
  }
  const context = {
    document,
    window: {
      atob(value) { return Buffer.from(value, 'base64').toString('latin1'); },
      btoa(value) { return Buffer.from(value, 'latin1').toString('base64'); },
      location: { href: 'https://example.test/' },
      setTimeout(callback) { callback(); },
    },
    XMLHttpRequest,
    Buffer,
    decodeURIComponent,
    encodeURIComponent,
    unescape,
  };
  vm.runInNewContext(await readFile(path.join(ROOT, relativePath), 'utf8'), context, { filename: relativePath });
  return elements;
}

function encodeAuthority(authority) {
  return Buffer.from(authority).toString('base64');
}

function decodeRawBase64(value) {
  return Buffer.from(value + '='.repeat((4 - (value.length % 4)) % 4), 'base64').toString();
}

async function generate(elements, nodeLink) {
  elements.get('nodeLink').value = nodeLink;
  elements.get('generator-form').listener('submit')({ preventDefault() {} });
  return elements.get('nodeResults').children.slice(-3).map((card) => card.children[1].value);
}

for (const frontend of ['frontend.js', 'pubilc/frontend.js']) {
  test(`${frontend} emits unpadded Base64 VMess URI authorities`, async () => {
    const elements = await loadFrontend(frontend);

    for (const user of ['a', 'ab', 'abc']) {
      const rawQuery = 'path=%2Findex&security=tls&remarks=origin&host=edge.example.com';
      const input = `vmess://${encodeAuthority(`${user}@origin.example.com:80`)}?${rawQuery}`;
      const links = await generate(elements, input);

      assert.equal(links.length, 3);
      links.forEach((link, index) => {
        const [authority, query] = link.slice('vmess://'.length).split('?');
        assert.ok(authority);
        assert.ok(query);
        assert.equal(authority.endsWith('='), false);
        assert.equal(decodeRawBase64(authority), `${user}@${IPs[index]}:80`);
        assert.equal(query, `path=%2Findex&security=tls&remarks=origin-${index + 1}&host=edge.example.com`);
      });
    }
  });

  test(`${frontend} keeps Base64 JSON serialization padded`, async () => {
    const elements = await loadFrontend(frontend);
    const source = { v: '2', ps: 'origin', add: 'origin.example.com', port: '80', id: 'abc' };
    const input = `vmess://${Buffer.from(JSON.stringify(source)).toString('base64')}`;
    const links = await generate(elements, input);

    links.forEach((link, index) => {
      const expected = Buffer.from(JSON.stringify({ ...source, add: IPs[index], ps: `origin-${index + 1}` })).toString('base64');
      assert.equal(link, `vmess://${expected}`);
    });
  });
}
