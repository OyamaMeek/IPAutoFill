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
  var statusLive = document.getElementById('statusLive');
  var pageContent = document.getElementById('pageContent');
  var lastFocusedElement = null;
  var lastNodes = [];
  var exampleLink = 'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

  if (!form || !nodeInput || !profileInput || !submitButton || !demoButton || !errorBox || !modal || !resultList || !closeButton || !closeFooterButton || !copyAllButton || !statusLive || !pageContent) return;

  demoButton.addEventListener('click', function () {
    nodeInput.value = exampleLink;
    nodeInput.focus();
    setError('');
    announce('已填入示例节点。');
  });

  nodeInput.addEventListener('input', function () {
    if (nodeInput.getAttribute('aria-invalid') === 'true') setError('');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    loadProfileIps(profileInput.value, function (ips, ipSource) {
      setSubmitting(false);
      if (!ips) {
        setError('未能读取 config.json，且内置线路不可用。');
        return;
      }
      try {
        lastNodes = generateNodesLocally(trim(nodeInput.value), ips);
        renderNodes(lastNodes);
        openModal();
        if (ipSource === 'fallback') announce('config.json 不可用，已使用内置线路 IP。');
      } catch (error) {
        setError(error && error.message ? error.message : '节点转换失败。');
      }
    });
  });

  closeButton.addEventListener('click', closeModal);
  closeFooterButton.addEventListener('click', closeModal);
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (event) {
    if (!modal.classList.contains('hidden') && (event.key === 'Escape' || event.keyCode === 27)) {
      closeModal();
      return;
    }
    if (!modal.classList.contains('hidden') && (event.key === 'Tab' || event.keyCode === 9)) trapModalFocus(event);
  });
  copyAllButton.addEventListener('click', function () {
    var links = [];
    var index;
    for (index = 0; index < lastNodes.length; index += 1) links.push(lastNodes[index].link);
    copyText(links.join('\n'), copyAllButton, '复制全部节点', '全部节点');
  });

  function generateNodesLocally(nodeLink, ips) {
    var source = parseVmessLink(nodeLink);
    var nodes = [];
    var index;
    var originalName = getSourceName(source);
    var baseName = stripTrailingNodeNumber(originalName);
    if (!ips || ips.length !== 3) throw new Error('线路 IP 数量不足三个。');

    for (index = 0; index < 3; index += 1) {
      var name = baseName + '-' + (index + 1);
      var link;
      if (source.format === 'json') {
        var clone = cloneObject(source.node);
        clone.add = ips[index];
        clone.ps = name;
        link = 'vmess://' + encodeBase64Utf8(JSON.stringify(clone));
      } else {
        link = serializeUriNode(source, ips[index], name);
      }
      nodes.push({ name: name, server: ips[index], link: link });
    }
    return nodes;
  }

  function loadProfileIps(profile, done) {
    readJson(profileConfigUrl(), function (error, data) {
      if (!error && isProfileConfig(data)) {
        deliverProfile(data, profile, done);
        return;
      }
      deliverProfile(null, profile, done);
    });
  }

  function deliverProfile(config, profile, done) {
    var ips;
    var source;
    if (config && Object.prototype.hasOwnProperty.call(config, profile)) {
      ips = config[profile];
      if (isIpList(ips)) {
        done(ips, 'config');
        return;
      }
    }
    source = PROFILE_IPS[profile];
    done(isIpList(source) ? source : null, 'fallback');
  }

  function profileConfigUrl() {
    var base = window.location.href;
    var cut = base.indexOf('#');
    if (cut !== -1) base = base.slice(0, cut);
    if (base.slice(-1) === '/') base = base.slice(0, -1);
    return base + '/config.json';
  }

  function readJson(url, done) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onreadystatechange = function () {
      var data;
      if (request.readyState !== 4) return;
      if (request.status < 200 || request.status >= 300) {
        done(new Error('config.json 请求失败'));
        return;
      }
      try {
        data = JSON.parse(request.responseText);
      } catch (ignored) {
        done(new Error('config.json 不是有效 JSON'));
        return;
      }
      done(null, data);
    };
    request.onerror = function () { done(new Error('config.json 请求失败')); };
    try {
      request.send();
    } catch (ignored) {
      done(new Error('config.json 请求失败'));
    }
  }

  function isProfileConfig(data) {
    return data && Object.prototype.toString.call(data) === '[object Object]' &&
      (isIpList(data.HZCT) || isIpList(data.HZCM));
  }

  function isIpList(list) {
    return Object.prototype.toString.call(list) === '[object Array]' && list.length === 3 &&
      list.every(function (ip) { return typeof ip === 'string' && trim(ip); });
  }

  function parseVmessLink(nodeLink) {
    var prefix = 'vmess://';
    var content;
    var queryIndex;
    var jsonNode;
    if (!nodeLink) throw new Error('请填写一条原始 VMess 节点链接。');
    if (nodeLink.slice(0, prefix.length).toLowerCase() !== prefix) throw new Error('当前仅支持 vmess:// 节点链接。');
    content = nodeLink.slice(prefix.length);
    queryIndex = content.indexOf('?');

    if (queryIndex === -1) {
      try {
        jsonNode = JSON.parse(decodeBase64Utf8(content));
      } catch (ignored) {
        throw new Error('原始节点不是有效的 VMess Base64 JSON 或 URI 链接。');
      }
      if (!jsonNode || Object.prototype.toString.call(jsonNode) !== '[object Object]') throw new Error('VMess 节点内容必须是 JSON 对象。');
      if (typeof jsonNode.add !== 'string' || !trim(jsonNode.add)) throw new Error('VMess 节点缺少有效的连接地址字段 add。');
      if (typeof jsonNode.ps !== 'string') throw new Error('VMess 节点缺少有效的名称字段 ps。');
      return { format: 'json', node: jsonNode };
    }

    return parseUriNode(content.slice(0, queryIndex), content.slice(queryIndex + 1));
  }

  function parseUriNode(encodedAuthority, rawQuery) {
    var authority;
    var atIndex;
    var endpoint;
    try {
      authority = decodeBase64Utf8(encodedAuthority);
    } catch (ignored) {
      throw new Error('VMess URI 的连接信息不是有效 Base64。');
    }
    atIndex = authority.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === authority.length - 1) throw new Error('VMess URI 缺少有效的用户或连接地址。');
    endpoint = parseEndpoint(authority.slice(atIndex + 1));
    return {
      format: 'uri',
      user: authority.slice(0, atIndex),
      port: endpoint.port,
      rawQuery: rawQuery,
      name: readRemarks(rawQuery)
    };
  }

  function parseEndpoint(endpoint) {
    var separator;
    var closeBracket;
    var host;
    var port;
    if (endpoint.charAt(0) === '[') {
      closeBracket = endpoint.indexOf(']');
      if (closeBracket <= 1 || endpoint.charAt(closeBracket + 1) !== ':') throw new Error('VMess URI 的 IPv6 地址或端口格式无效。');
      host = endpoint.slice(1, closeBracket);
      port = endpoint.slice(closeBracket + 2);
    } else {
      separator = endpoint.lastIndexOf(':');
      if (separator <= 0 || separator === endpoint.length - 1 || endpoint.slice(0, separator).indexOf(':') !== -1) throw new Error('VMess URI 的连接地址或端口格式无效。');
      host = endpoint.slice(0, separator);
      port = endpoint.slice(separator + 1);
    }
    if (!trim(host) || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('VMess URI 的连接地址或端口格式无效。');
    return { host: host, port: port };
  }

  function serializeUriNode(source, ip, name) {
    var authority = source.user + '@' + (ip.indexOf(':') === -1 ? ip : '[' + ip + ']') + ':' + source.port;
    return 'vmess://' + encodeBase64Utf8(authority) + '?' + rewriteRemarks(source.rawQuery, name).query;
  }

  function rewriteRemarks(rawQuery, name) {
    var parts = rawQuery.split('&');
    var rewritten = [];
    var remarksCount = 0;
    var index;
    for (index = 0; index < parts.length; index += 1) {
      var part = parts[index];
      var equalIndex = part.indexOf('=');
      var rawKey = equalIndex === -1 ? part : part.slice(0, equalIndex);
      var decodedKey;
      try {
        decodedKey = decodeURIComponent(rawKey);
      } catch (ignored) {
        decodedKey = rawKey;
      }
      if (decodedKey === 'remarks') {
        remarksCount += 1;
        rewritten.push(rawKey + '=' + encodeURIComponent(name));
      } else {
        rewritten.push(part);
      }
    }
    if (remarksCount > 1) throw new Error('VMess URI 包含多个 remarks 参数，无法确定节点名称。');
    if (remarksCount === 0) rewritten.push('remarks=' + encodeURIComponent(name));
    return { query: rewritten.join('&'), remarksCount: remarksCount };
  }

  function getSourceName(source) {
    return source.format === 'json' ? source.node.ps : source.name;
  }

  function stripTrailingNodeNumber(name) {
    return String(name || '').replace(/-\d+$/, '');
  }

  function readRemarks(rawQuery) {
    var parts = rawQuery.split('&');
    var name = '';
    var count = 0;
    var index;
    for (index = 0; index < parts.length; index += 1) {
      var equalIndex = parts[index].indexOf('=');
      var rawKey = equalIndex === -1 ? parts[index] : parts[index].slice(0, equalIndex);
      var rawValue = equalIndex === -1 ? '' : parts[index].slice(equalIndex + 1);
      var decodedKey;
      try { decodedKey = decodeURIComponent(rawKey); } catch (ignored) { decodedKey = rawKey; }
      if (decodedKey === 'remarks') {
        count += 1;
        try { name = decodeURIComponent(rawValue); } catch (ignoredValue) { throw new Error('VMess URI 的 remarks 参数编码无效。'); }
      }
    }
    if (count > 1) throw new Error('VMess URI 包含多个 remarks 参数，无法确定节点名称。');
    return name;
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
    copyButton.addEventListener('click', function () { copyText(link.value, copyButton, '复制节点', '节点 ' + node.name); });
    card.appendChild(header);
    card.appendChild(link);
    card.appendChild(copyButton);
    return card;
  }

  function copyText(text, button, originalLabel, itemLabel) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopyState(button, originalLabel, true, itemLabel);
      }, function () {
        fallbackCopy(text, button, originalLabel, itemLabel);
      });
      return;
    }
    fallbackCopy(text, button, originalLabel, itemLabel);
  }

  function fallbackCopy(text, button, originalLabel, itemLabel) {
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
    showCopyState(button, originalLabel, copied, itemLabel);
  }

  function showCopyState(button, originalLabel, copied, itemLabel) {
    button.textContent = copied ? '已复制' : '请手动复制';
    announce(copied ? itemLabel + '已复制到剪贴板。' : itemLabel + '复制失败，请手动选择链接复制。');
    window.setTimeout(function () { button.textContent = originalLabel; }, 1200);
  }

  function openModal() {
    lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    pageContent.setAttribute('aria-hidden', 'true');
    closeButton.focus();
    announce('已生成三个节点，结果窗口已打开。');
  }

  function closeModal() {
    modal.classList.add('hidden');
    pageContent.removeAttribute('aria-hidden');
    if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
  }

  function trapModalFocus(event) {
    var focusable = modal.querySelectorAll('button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setSubmitting(value) { submitButton.disabled = value; submitButton.textContent = value ? '转换中…' : '生成三个节点'; }

  function setError(message) {
    errorBox.textContent = message;
    if (message) {
      errorBox.classList.remove('hidden');
      nodeInput.setAttribute('aria-invalid', 'true');
      errorBox.focus();
    } else {
      errorBox.classList.add('hidden');
      nodeInput.removeAttribute('aria-invalid');
    }
  }

  function announce(message) { statusLive.textContent = ''; window.setTimeout(function () { statusLive.textContent = message; }, 20); }

  function trim(value) { return String(value).replace(/^\s+|\s+$/g, ''); }
}());
