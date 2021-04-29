<script lang="ts" setup>
  import { onMounted, onUnmounted, defineProps, watchEffect } from "vue";
  import LoadingComponentVue from "./LoadingComponent.vue";

  const { lang } = defineProps({
    lang: {
      type: String,
      default: "zh",
      required: false,
      validator: (value: string) => {
        return ["zh", "en"].includes(value);
      },
    },
  });

  ref: i = 0;

  setTimeout(() => setInterval(() => i++, 3200), 1600);

  const toDocs = () => {
    location.href = "/intro.html";
  };

  const toGithub = () => {
    location.href = "https://github.com/akirarika/kurimudb";
  };

  let navBarBottomBorderStyle = "";

  const localizedText = {
    default: "zh",
    "足够简单的，": {
      en: "Simple Enouth",
    },
    "渐进式的，": {
      en: "Progressive",
    },
    "驱动化的，": {
      en: "Driven",
    },
    "框架无关的，": {
      en: "Framework Independent ",
    },
    前端存储: {
      en: "Front-end Storage",
    },
    "解决方案。": {
      en: " Solution",
    },
    阅读文档: {
      en: "Reading Document",
    },
  };

  const text = (key: string) => {
    if (lang === localizedText.default) {
      return key;
    }
    return localizedText[key][lang];
  };

  onMounted(() => {
    const navBar = document.querySelector(".nav-bar") as HTMLHeadElement;
    if (!!navBar) {
      navBarBottomBorderStyle = navBar.style.borderBottom;
      navBar.style.borderBottom = "none";
    }
  });

  onUnmounted(() => {
    const navBar = document.querySelector(".nav-bar") as HTMLHeadElement;
    if (!!navBar) {
      navBar.style.borderBottom = navBarBottomBorderStyle;
    }
  });

  /**
   * Loading 动画
   */
  ref: loaded = false;
  ref: loadCounter = 0;

  onMounted(() => {
    watchEffect(() => {
      if (1 <= loadCounter) setTimeout(() => (loaded = true), 800);
    });
    setTimeout(() => (loaded = true), 4800);
  });
</script>

<template>
  <transition name="fade">
    <LoadingComponentVue v-if="!loaded" />
  </transition>
  <div v-show="loaded" class="index">
    <i class="ri-anchor-line index-logo"></i>
    <div class="welcome">
      <img src="./kurimu.png" @load="++loadCounter" />
      <div class="welcome-title">
        <transition name="fade" mode="out-in">
          <div v-if="0 === i % 4" class="welcome-title--text1">
            {{ text("足够简单的，") }}
          </div>
          <div v-else-if="1 === i % 4" class="welcome-title--text1">
            {{ text("渐进式的，") }}
          </div>
          <div v-else-if="2 === i % 4" class="welcome-title--text1">
            {{ text("驱动化的，") }}
          </div>
          <div v-else-if="3 === i % 4" class="welcome-title--text1">
            {{ text("框架无关的，") }}
          </div>
        </transition>
        <div class="welcome-title--text2">
          <span style="text-decoration: underline">{{ text("前端存储") }}</span
          >{{ text("解决方案。") }}
        </div>
        <div class="welcome-button-group">
          <div class="welcome-button--docs" @click="toDocs">
            <i class="ri-anchor-line"></i>
            <span>{{ text("阅读文档") }}</span>
          </div>
          <div class="welcome-button--github" @click="toGithub">
            <i class="ri-github-fill"></i>
            <div class="welcome-button--github-corner">
              <img
                src="https://img.shields.io/github/stars/akirarika/kurimudb?color=%2300000000&label=%20&style=for-the-badge"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="index-markdown">
      <slot></slot>
    </div>
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
