export function cacheDisable() {
  return (req, res, next) => {
    res.set('Cache-control', `no-store`);
    return next();
  };
}
