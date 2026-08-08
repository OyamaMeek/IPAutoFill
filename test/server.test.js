const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { generateNodes, parseVmessLink } = require('../server');

const sourceNode = {
  v: '2',
  ps: 'source-name',
  add: 'origin.example.com',
  port: '443',
  id: '00000000-0000-4000-8000-000000000001',
  net: 'ws',
  tls: 'tls',
  path: '/ws',
  host: 'origin.example.com',
  sni: 'origin.example.com',
  fp: 'chrome',
  alpn: 'h2,http/1.1',
};
const sourceLink = `vmess://${Buffer.from(JSON.stringify(sourceNode)).toString('base64')}`;

async function configFile(value) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ipautofill-test-'));
  const file = path.join(directory, 'config.json');
  await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
}

test('HZCT creates three VMess links while changing only add and ps', async () => {
  const ips = ['172.64.147.132', '172.64.52.79', '162.159.45.77'];
  const configPath = await configFile({ HZCT: ips, HZCM: ['1.1.1.1', '1.1.1.2', '1.1.1.3'] });
  const nodes = await generateNodes({ nodeLink: sourceLink, profile: 'HZCT' }, { configPath });

  assert.equal(nodes.length, 3);
  nodes.forEach((output, index) => {
    assert.equal(output.name, `-${index + 1}`);
    assert.equal(output.server, ips[index]);
    const decoded = parseVmessLink(output.link);
    assert.deepEqual(decoded, { ...sourceNode, add: ips[index], ps: `-${index + 1}` });
  });
});

test('HZCM uses its configured order', async () => {
  const ips = ['5.6.7.8', '5.6.7.9', '5.6.7.10'];
  const configPath = await configFile({ HZCT: ['1.1.1.1', '1.1.1.2', '1.1.1.3'], HZCM: ips });
  const nodes = await generateNodes({ nodeLink: sourceLink, profile: 'HZCM' }, { configPath });
  assert.deepEqual(nodes.map((node) => node.server), ips);
  assert.deepEqual(nodes.map((node) => node.name), ['-1', '-2', '-3']);
});

test('rejects malformed nodes and unsupported profiles', async () => {
  const configPath = await configFile({ HZCT: ['1.1.1.1', '1.1.1.2', '1.1.1.3'], HZCM: ['2.2.2.1', '2.2.2.2', '2.2.2.3'] });
  await assert.rejects(() => generateNodes({ nodeLink: 'vless://x', profile: 'HZCT' }, { configPath }), /仅支持/);
  await assert.rejects(() => generateNodes({ nodeLink: sourceLink, profile: 'OTHER' }, { configPath }), /HZCT 或 HZCM/);
});

test('rejects invalid and insufficient configuration', async () => {
  const shortConfig = await configFile({ HZCT: ['1.1.1.1'], HZCM: ['2.2.2.1', '2.2.2.2', '2.2.2.3'] });
  await assert.rejects(() => generateNodes({ nodeLink: sourceLink, profile: 'HZCT' }, { configPath: shortConfig }), /不足三个/);
  const invalidConfig = await configFile('{ nope');
  await assert.rejects(() => generateNodes({ nodeLink: sourceLink, profile: 'HZCT' }, { configPath: invalidConfig }), /config.json/);
});
