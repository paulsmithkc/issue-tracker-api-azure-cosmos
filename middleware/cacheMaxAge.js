export function cacheMaxAge(maxAgeInSeconds) {
  return (req, res, next) => {
    if (req.method === 'GET') {
      res.set('Cache-control', `max-age=${maxAgeInSeconds}`);
    } else {
      res.set('Cache-control', `no-store`);
    }
    return next();
  };
}
