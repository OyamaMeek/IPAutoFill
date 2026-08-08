(function () {
  'use strict';

  var PROFILE_IPS = {
    HZCT: ['172.64.147.132', '172.64.52.79', '162.159.45.77'],
    HZCM: ['5.6.7.8', '5.6.7.9', '5.6.7.10']
  };

  var form = document.getElementById('generator-form');
  var nodeInput = document.getElementById('nodeLink');
  var profileInput = document.getElementById('profile');
  var submitButton = document.getElementById('submitBtn');
  var demoButton = document.getElementById('fillDemoBtn');
  var errorBox = document.getElementById('warningBox');
  var modal = document.getElementById('resultModal');
  var resultList = document.getElementById('nodeResults');
  var closeButton = document.getElementById('closeModalBtn');
  var closeFooterButton = document.getElementById('closeModalFooterBtn');
  var copyAllButton = document.getElementById('copyAllBtn');
  var lastNodes = [];
  var exampleLink = 'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

  if (!form || !nodeInput || !profileInput || !submitButton || !demoButton || !errorBox || !modal || !resultList || !closeButton || !closeFooterButton || !copyAllButton) return;

  demoButton.addEventListener('click', function () {
    nodeInput.value = exampleLink;
    nodeInput.focus();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      lastNodes = generateNodesLocally(trim(nodeInput.value), profileInput.value);
      renderNodes(lastNodes);
      openModal();
    } catch (error) {
      setError(error && error.message ? error.message : '节点转换失败。');
    }
    setSubmitting(false);
  });

  closeButton.addEventListener('click', closeModal);
  closeFooterButton.addEventListener('click', closeModal);
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.keyCode === 27) closeModal();
  });
  copyAllButton.addEventListener('click', function () {
    var links = [];
    var index;
    for (index = 0; index < lastNodes.length; index += 1) links.push(lastNodes[index].link);
    copyText(links.join('\n'), copyAllButton, '复制全部节点');
  });

  function generateNodesLocally(nodeLink, profile) {
    var source = parseVmessLink(nodeLink);
    var ips = PROFILE_IPS[profile];
    var nodes = [];
    var index;
    if (!ips || ips.length !== 3) throw new Error('只支持 HZCT 或 HZCM 选项。');

    for (index = 0; index < 3; index += 1) {
      var clone = cloneObject(source);
      clone.add = ips[index];
      clone.ps = '-' + (index + 1);
      nodes.push({ name: clone.ps, server: clone.add, link: 'vmess://' + encodeBase64Utf8(JSON.stringify(clone)) });
    }
    return nodes;
  }

  function parseVmessLink(nodeLink) {
    var prefix = 'vmess://';
    var node;
    if (!nodeLink) throw new Error('请填写一条原始 VMess 节点链接。');
    if (nodeLink.slice(0, prefix.length).toLowerCase() !== prefix) throw new Error('当前仅支持 vmess:// Base64 JSON 格式的节点链接。');
    try {
      node = JSON.parse(decodeBase64Utf8(nodeLink.slice(prefix.length)));
    } catch (ignored) {
      throw new Error('原始节点不是有效的 VMess Base64 JSON 链接。');
    }
    if (!node || Object.prototype.toString.call(node) !== '[object Object]') throw new Error('VMess 节点内容必须是 JSON 对象。');
    if (typeof node.add !== 'string' || !trim(node.add)) throw new Error('VMess 节点缺少有效的连接地址字段 add。');
    if (typeof node.ps !== 'string') throw new Error('VMess 节点缺少有效的名称字段 ps。');
    return node;
  }

  function decodeBase64Utf8(value) {
    var normalized = trim(value).replace(/-/g, '+').replace(/_/g, '/');
    var padding;
    var binary;
    if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) throw new Error('invalid base64');
    normalized = normalized.replace(/=+$/, '');
    padding = normalized.length % 4;
    if (padding === 1) throw new Error('invalid base64');
    while (normalized.length % 4) normalized += '=';
    binary = window.atob(normalized);
    return decodeUtf8(binary);
  }

  function encodeBase64Utf8(value) {
    return window.btoa(encodeUtf8(value));
  }

  function decodeUtf8(binary) {
    var encoded = '';
    var index;
    for (index = 0; index < binary.length; index += 1) encoded += '%' + ('00' + binary.charCodeAt(index).toString(16)).slice(-2);
    return decodeURIComponent(encoded);
  }

  function encodeUtf8(value) {
    return unescape(encodeURIComponent(value));
  }

  function cloneObject(source) {
    return JSON.parse(JSON.stringify(source));
  }

  function renderNodes(nodes) {
    var fragment = document.createDocumentFragment();
    var index;
    for (index = 0; index < nodes.length; index += 1) fragment.appendChild(createNodeCard(nodes[index]));
    resultList.textContent = '';
    resultList.appendChild(fragment);
  }

  function createNodeCard(node) {
    var card = document.createElement('article');
    var header = document.createElement('header');
    var name = document.createElement('span');
    var address = document.createElement('span');
    var link = document.createElement('textarea');
    var copyButton = document.createElement('button');
    card.className = 'node-card';
    name.className = 'node-name';
    name.textContent = node.name;
    address.className = 'server';
    address.textContent = node.server;
    header.appendChild(name);
    header.appendChild(address);
    link.readOnly = true;
    link.value = node.link;
    link.setAttribute('aria-label', node.name + ' 节点链接');
    copyButton.className = 'copy';
    copyButton.type = 'button';
    copyButton.textContent = '复制节点';
    copyButton.addEventListener('click', function () { copyText(link.value, copyButton, '复制节点'); });
    card.appendChild(header);
    card.appendChild(link);
    card.appendChild(copyButton);
    return card;
  }

  function copyText(text, button, originalLabel) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopyState(button, originalLabel, true);
      }, function () {
        fallbackCopy(text, button, originalLabel);
      });
      return;
    }
    fallbackCopy(text, button, originalLabel);
  }

  function fallbackCopy(text, button, originalLabel) {
    var temporary = document.createElement('textarea');
    var copied = false;
    temporary.value = text;
    temporary.setAttribute('readonly', 'readonly');
    temporary.style.position = 'fixed';
    temporary.style.opacity = '0';
    document.body.appendChild(temporary);
    temporary.select();
    try {
      copied = document.execCommand('copy');
    } catch (ignored) {
      copied = false;
    }
    document.body.removeChild(temporary);
    showCopyState(button, originalLabel, copied);
  }

  function showCopyState(button, originalLabel, copied) {
    button.textContent = copied ? '已复制' : '请手动复制';
    window.setTimeout(function () { button.textContent = originalLabel; }, 1200);
  }

  function openModal() { modal.classList.remove('hidden'); closeButton.focus(); }
  function closeModal() { modal.classList.add('hidden'); }
  function setSubmitting(value) { submitButton.disabled = value; submitButton.textContent = value ? '转换中…' : '生成三个节点'; }
  function setError(message) { errorBox.textContent = message; if (message) errorBox.classList.remove('hidden'); else errorBox.classList.add('hidden'); }
  function trim(value) { return String(value).replace(/^\s+|\s+$/g, ''); }
}());
