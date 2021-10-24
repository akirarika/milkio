<script lang="ts" setup>
import { onMounted, onUnmounted, defineProps, watchEffect, ref } from 'vue';
import LoadingComponentVue from './LoadingComponent.vue';

const { lang } = defineProps({
  lang: {
    type: String,
    required: false,
    validator: (value: string) => {
      return ['zh', 'en'].includes(value);
    },
  },
});

const i = ref(0);

setTimeout(() => setInterval(() => i.value++, 2000), 3200);

let navBarBottomBorderStyle = '';

const localizedText = {
  default: 'zh',
  '足够简单的，': {
    en: 'Simple Enough',
  },
  '渐进式的，': {
    en: 'Progressive',
  },
  '驱动化的，': {
    en: 'Driven',
  },
  '框架无关的，': {
    en: 'Framework Independent ',
  },
  前端存储: {
    en: 'Front-end Storage',
  },
  '解决方案。': {
    en: ' Solution',
  },
  阅读文档: {
    en: 'Read the Documentation',
  },
};

const show = ref(false);

const text = (key: string) => {
  if (lang === localizedText.default) {
    return key;
  }
  return localizedText[key][lang];
};

onMounted(() => {
  const navBar = document.querySelector('.nav-bar') as HTMLHeadElement;
  if (!!navBar) {
    navBarBottomBorderStyle = navBar.style.borderBottom;
    navBar.style.borderBottom = 'none';
  }
});

onUnmounted(() => {
  const navBar = document.querySelector('.nav-bar') as HTMLHeadElement;
  if (!!navBar) {
    navBar.style.borderBottom = navBarBottomBorderStyle;
  }
});

setTimeout(() => {
  show.value = true;
}, 233);
</script>

<template>
  <!-- <div v-show="!show" id="global-loading">
    <img
      src="data:image/gif;base64,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"
    />
    <div id="global-loading--progress">
      <div id="global-loading--progress-indeterminate"></div>
    </div>
  </div> -->
  <div class="index">
    <i class="ri-anchor-line index-logo"></i>
    <div class="welcome">
      <img src="./assets/kurimu.png" />
      <div class="welcome-title">
        <transition name="fade" mode="out-in"
          ><div class="welcome-title--text1" v-if="0 === i % 4">
            {{ text('足够简单的，') }}
          </div>
          <div class="welcome-title--text1" v-else-if="1 === i % 4">
            {{ text('渐进式的，') }}
          </div>
          <div class="welcome-title--text1" v-else-if="2 === i % 4">
            {{ text('驱动化的，') }}
          </div>
          <div class="welcome-title--text1" v-else-if="3 === i % 4">
            {{ text('框架无关的，') }}
          </div></transition
        >
        <div class="welcome-title--text2">
          <span style="text-decoration: underline">{{ text('前端存储') }}</span
          >{{ text('解决方案。') }}
        </div>
        <div class="welcome-button-group">
          <a class="welcome-button--docs" href="./docs/intro/">
            <i class="ri-anchor-line"></i><span>{{ text('阅读文档') }}</span>
          </a>
          <a
            class="welcome-button--github"
            href="https://github.com/akirarika/kurimudb"
          >
            <i class="ri-github-fill"></i>
            <div class="welcome-button--github-corner">
              <img
                src="https://img.shields.io/github/stars/akirarika/kurimudb?color=%2300000000&label=%20&style=for-the-badge"
              />
            </div>
          </a>
        </div>
      </div>
    </div>
    <div class="index-markdown"><slot></slot></div>
  </div>
</template>

<style>
.index-markdown {
  display: flex;
  width: 520px;
  max-width: 100%;
  align-items: center;
  flex-direction: column;
  opacity: 0;
  animation: welcome 0.4s ease-out;
  animation-delay: 0.8s;
  animation-fill-mode: forwards;
}

.index-markdown > h1 {
  margin-top: 56px;
  color: rgba(6, 16, 56, 0.8);
  font-size: 26px;
}

.index-markdown > p {
  padding-left: 16px;
  padding-right: 16px;
  text-align: center;
  margin: 1em 0 0 0;
}

.index-markdown > div {
  width: 100%;
}

.index {
  position: fixed;
  top: 56px;
  left: 0;
  height: calc(100% - 56px);
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 160px;
  background: rgb(255, 255, 255);
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.welcome {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 80px 0 0px 0;
  opacity: 0;
  animation: welcome 0.4s ease-out;
  animation-delay: 0.32s;
  animation-fill-mode: forwards;
}

@keyframes welcome {
  0% {
    opacity: 0;
    transform: translateY(16px);
  }
  100% {
    opacity: 1;
    transform: translateY(0px);
  }
}

@keyframes float {
  0% {
    transform: translateY(-4px);
  }
  50% {
    transform: translateY(0px);
  }
  100% {
    transform: translateY(-4px);
  }
}

.welcome > img {
  width: 352px;
  height: auto;
  aspect-ratio: 1/1;
  margin-right: -36px;
  margin-left: -32px;
  opacity: 0.84;
  pointer-events: none;
}

.welcome-title {
  display: flex;
  flex-direction: column;
}

.welcome-title--text1 {
  font-size: 28px;
  color: rgba(6, 16, 56, 0.88);
  font-weight: bold;
  padding-bottom: 8px;
}

.welcome-title--text2 {
  color: rgba(6, 16, 56, 0.88);
  font-size: 30px;
  padding-bottom: 56px;
}

.welcome-button-group {
  display: flex;
  align-items: center;
  padding-bottom: 4px;
}

.welcome-button-group a {
  text-decoration: none;
}

.welcome-button--docs {
  height: 48px;
  border-radius: 16px;
  background: rgb(24, 92, 255);
  color: rgb(250, 250, 250);
  font-size: 16px;
  padding: 0 28px;
  box-shadow: 0 16px 16px -8px rgba(24, 92, 255, 0.36);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.welcome-button--docs > i {
  font-size: 20px;
}

.welcome-button--docs > span {
  margin: 0 8px 0 16px;
}

.welcome-button--github {
  position: relative;
  margin-left: 16px;
  box-sizing: border-box;
  border-radius: 16px;
  border-color: rgb(233, 233, 233);
  border-width: 3px;
  border-style: solid;
  font-size: 26px;
  height: 52px;
  width: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(6, 16, 56, 0.88);
}

.welcome-button--github-corner {
  position: absolute;
  overflow: hidden;
  top: -8px;
  right: -20px;
  background: rgb(48, 64, 80);
  height: 20px;
  width: auto;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-button--github-corner > img {
  height: 28px;
}

.index-footer {
  display: flex;
  justify-content: center;
  margin-top: 80px;
}

.index-logo {
  display: none;
}

.fade-enter-active {
  transition: all 0.16s ease-out;
  transform: translateX(-4px);
  opacity: 0;
}

.fade-enter-to {
  transition: all 0.16s ease-out;
  transform: translateX(0);
  opacity: 1;
}

.fade-leave-active {
  transition: all 0.16s ease-out;
  transform: translateX(0);
  opacity: 1;
}

.fade-leave-to {
  transition: all 0.12s ease-out;
  transform: translateX(4px);
  opacity: 0.16;
}

/**
   * 适配移动端
   */

@media all and (max-width: 768px) {
  .welcome {
    flex-direction: column;
    padding: 16px 0 40px 0;
  }

  .welcome > img {
    margin-right: -24px;
    margin-left: 0px;
  }

  .welcome-title {
    align-items: center;
  }

  .index-logo {
    position: fixed;
    display: flex;
    top: 8px;
    left: 20px;
    z-index: 11;
    background: #fff;
    font-size: 28px;
  }
}
</style>
