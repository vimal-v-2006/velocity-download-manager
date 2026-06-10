function isPixeldrainUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.hostname === 'pixeldrain.com' || url.hostname.endsWith('.pixeldrain.com');
  } catch {
    return false;
  }
}

function buildDownloadOptions(payload, defaultDownloadDir) {
  const requestedSplit = Number(payload.split || 16);
  const safeSplit = Number.isFinite(requestedSplit) ? Math.max(1, Math.min(16, requestedSplit)) : 16;
  const options = {
    dir: payload.dir || defaultDownloadDir,
    split: String(safeSplit),
    'max-connection-per-server': String(safeSplit),
    continue: 'true',
    'http-accept-gzip': 'false',
  };

  if (isPixeldrainUrl(payload.url)) {
    return {
      ...options,
      split: '1',
      'max-connection-per-server': '1',
      'min-split-size': '1M',
      'allow-overwrite': 'false',
    };
  }

  return options;
}

module.exports = { buildDownloadOptions, isPixeldrainUrl };
