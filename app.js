const form = document.getElementById('generator-form');
const nodeLink = document.getElementById('nodeLink');
const profile = document.getElementById('profile');
const submitBtn = document.getElementById('submitBtn');
const fillDemoBtn = document.getElementById('fillDemoBtn');
const warningBox = document.getElementById('warningBox');
const resultSection = document.getElementById('resultSection');
const nodeResults = document.getElementById('nodeResults');

const demoVmess = 'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

fillDemoBtn.addEventListener('click', () => {
  nodeLink.value = demoVmess;
  nodeLink.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideWarning();
  resultSection.classList.add('hidden');
  nodeResults.replaceChildren();

  submitBtn.disabled = true;
  submitBtn.textContent = '生成中…';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeLink: nodeLink.value, profile: profile.value }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || '生成失败。');
    }
    renderNodes(data.nodes);
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showWarning(error.message || '请求失败。');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '生成三个节点';
  }
});

function renderNodes(nodes) {
  const fragment = document.createDocumentFragment();
  nodes.forEach((node) => {
    const card = document.createElement('article');
    card.className = 'node-card';

    const header = document.createElement('header');
    const name = document.createElement('span');
    name.className = 'node-name';
    name.textContent = node.name;
    const server = document.createElement('span');
    server.className = 'server';
    server.textContent = node.server;
    header.append(name, server);

    const link = document.createElement('textarea');
    link.readOnly = true;
    link.value = node.link;
    link.setAttribute('aria-label', `${node.name} 节点链接`);

    const copy = document.createElement('button');
    copy.className = 'copy';
    copy.type = 'button';
    copy.textContent = '复制节点';
    copy.addEventListener('click', () => copyLink(link, copy));

    card.append(header, link, copy);
    fragment.append(card);
  });
  nodeResults.replaceChildren(fragment);
}

async function copyLink(input, button) {
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand('copy');
  }
  const previous = button.textContent;
  button.textContent = '已复制';
  setTimeout(() => { button.textContent = previous; }, 1200);
}

function showWarning(message) {
  warningBox.textContent = message;
  warningBox.classList.remove('hidden');
}

function hideWarning() {
  warningBox.textContent = '';
  warningBox.classList.add('hidden');
}
