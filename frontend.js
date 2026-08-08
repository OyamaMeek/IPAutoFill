(function () {
  'use strict';

  var form = document.getElementById('generator-form');
  var nodeInput = document.getElementById('nodeLink');
  var profileInput = document.getElementById('profile');
  var submitButton = document.getElementById('submitBtn');
  var demoButton = document.getElementById('fillDemoBtn');
  var errorBox = document.getElementById('warningBox');
  var resultSection = document.getElementById('resultSection');
  var resultList = document.getElementById('nodeResults');
  var exampleLink = 'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

  if (!form || !nodeInput || !profileInput || !submitButton || !demoButton || !errorBox || !resultSection || !resultList) {
    return;
  }

  demoButton.addEventListener('click', function () {
    nodeInput.value = exampleLink;
    nodeInput.focus();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setError('');
    hideResults();
    setSubmitting(true);

    sendGenerateRequest({
      nodeLink: trim(nodeInput.value),
      profile: profileInput.value
    }, function (error, data) {
      setSubmitting(false);

      if (error) {
        setError(error);
        return;
      }
      if (!data || !data.ok || !isThreeNodes(data.nodes)) {
        setError((data && data.error) || '服务端未返回三个节点。');
        return;
      }

      renderNodes(data.nodes);
      resultSection.classList.remove('hidden');
      try {
        resultSection.scrollIntoView();
      } catch (ignored) {
        // Results are visible even when the browser cannot scroll automatically.
      }
    });
  });

  function sendGenerateRequest(payload, done) {
    var request = new XMLHttpRequest();
    request.open('POST', '/api/generate', true);
    request.setRequestHeader('Content-Type', 'application/json');
    request.onreadystatechange = function () {
      var data;
      if (request.readyState !== 4) {
        return;
      }
      try {
        data = JSON.parse(request.responseText || '{}');
      } catch (ignored) {
        done('服务器返回了无效响应。');
        return;
      }
      if (request.status < 200 || request.status >= 300 || !data.ok) {
        done(data.error || '生成节点失败。');
        return;
      }
      done(null, data);
    };
    request.onerror = function () {
      done('请求失败，请确认服务已通过 npm start 启动。');
    };
    try {
      request.send(JSON.stringify(payload));
    } catch (error) {
      done('请求发送失败。');
    }
  }

  function isThreeNodes(nodes) {
    return Object.prototype.toString.call(nodes) === '[object Array]' && nodes.length === 3;
  }

  function renderNodes(nodes) {
    var fragment = document.createDocumentFragment();
    var index;
    for (index = 0; index < nodes.length; index += 1) {
      fragment.appendChild(createNodeCard(nodes[index]));
    }
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
    copyButton.addEventListener('click', function () {
      copyNodeLink(link, copyButton);
    });

    card.appendChild(header);
    card.appendChild(link);
    card.appendChild(copyButton);
    return card;
  }

  function copyNodeLink(linkInput, button) {
    linkInput.focus();
    linkInput.select();
    document.execCommand('copy');
    linkInput.setSelectionRange(0, 0);
    button.textContent = '已复制';
    window.setTimeout(function () {
      button.textContent = '复制节点';
    }, 1200);
  }

  function hideResults() {
    resultSection.classList.add('hidden');
    resultList.textContent = '';
  }

  function setSubmitting(value) {
    submitButton.disabled = value;
    submitButton.textContent = value ? '生成中…' : '生成三个节点';
  }

  function setError(message) {
    errorBox.textContent = message;
    if (message) {
      errorBox.classList.remove('hidden');
    } else {
      errorBox.classList.add('hidden');
    }
  }

  function trim(value) {
    return String(value).replace(/^\s+|\s+$/g, '');
  }
}());
