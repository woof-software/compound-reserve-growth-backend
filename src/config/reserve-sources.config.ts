import { registerAs } from '@nestjs/config';

export type ReserveSourcesConfig = {
  repoUrl: string;
  rawAssetsUrl: string;
  rawSourcesUrl: string;
  requestTimeoutMs: number;
};

export default registerAs('reserveSources', (): ReserveSourcesConfig => {
  const repoOwner = 'woof-software';
  const repoName = 'compound-reserve-sources';
  const repoBranch = 'main';
  const dataPath = 'data';
  const assetsFile = 'assets.json';
  const sourcesFile = 'sources.json';
  const rawBaseUrl = 'https://raw.githubusercontent.com';

  const repoUrl = `https://github.com/${repoOwner}/${repoName}`;
  const rawRoot = `${rawBaseUrl}/${repoOwner}/${repoName}/${repoBranch}/${dataPath}`;

  return {
    repoUrl,
    rawAssetsUrl: `${rawRoot}/${assetsFile}`,
    rawSourcesUrl: `${rawRoot}/${sourcesFile}`,
    requestTimeoutMs: 15000,
  };
});
