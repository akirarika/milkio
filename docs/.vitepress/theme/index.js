import DefaultTheme from 'vitepress/theme';
import Layout from '../../components/Layout.vue';
import 'remixicon/fonts/remixicon.css';
import './index.css';

export default {
  ...DefaultTheme,
  Layout: Layout,
  enhanceApp({ app, router, siteData }) {
    // app is the Vue 3 app instance from `createApp()`. router is VitePress'
    // custom router. `siteData`` is a `ref`` of current site-level metadata.
  },
};
