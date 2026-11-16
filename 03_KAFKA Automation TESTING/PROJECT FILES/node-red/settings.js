// Minimal Node-RED runtime settings for the Kafka QA assessment.
// Everything not listed here uses Node-RED defaults.
module.exports = {
  uiPort: process.env.PORT || 1880,
  flowFile: 'flows.json',
  flowFilePretty: true,
  credentialSecret: false,

  // Make the Kafka client library and the shared event contract available to
  // function nodes as global.get('kafkajs') and global.get('orderEvent').
  functionGlobalContext: {
    kafkajs: require('kafkajs'),
    orderEvent: require('./lib/order-event.js'),
  },

  logging: {
    console: { level: 'info', metrics: false, audit: false },
  },
  editorTheme: { tours: false, projects: { enabled: false } },
};
