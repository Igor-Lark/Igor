module.exports = {
  apps: [
    {
      name: 'klinkerpro',
      cwd: __dirname,
      script: 'src/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        TZ: 'Europe/Moscow',
      },
      max_restarts: 20,
    },
  ],
};
