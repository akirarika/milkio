<script lang="ts" setup>
  import { defineProps, defineEmit, onMounted, nextTick } from "vue";

  ref: progress = 0;

  onMounted(() => {
    const timer = setInterval(() => {
      if (99 <= progress) return clearInterval(timer);
      return ++progress;
    }, 32);
  });
</script>

<template>
  <div class="loading">
    <img src="./assets/loading.gif" />
    <p>{{ progress }}%</p>
  </div>
</template>

<style>
  .loading {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgb(255, 255, 255);
  }

  .loading > img {
    width: 128px;
    height: 128px;
    opacity: 0.88;
    pointer-events: none;
    animation: loading 0.8s ease-out;
  }

  .loading > p {
    margin-top: 0;
    color: rgba(6, 16, 56, 0.8);
    font-size: 14px;
    font-weight: bold;
  }
</style>
