module.exports = {
    apps: [
      {
        name: 'orderly-MMbot',
        script: './dist/index.js',
        watch: true,
        env: {
          NODE_ENV: 'development',
        },
        env_production: {
          NODE_ENV: 'production',
        },
      },
    ],
  };