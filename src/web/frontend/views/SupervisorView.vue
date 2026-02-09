<template>
  <div>
    <h1 class="page-title">슈퍼바이저</h1>

    <FileEditor ref="editorRef" />

    <ChatPanel @file-changed="onFileChanged" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FileEditor from '../components/FileEditor.vue'
import ChatPanel from '../components/ChatPanel.vue'

const editorRef = ref<InstanceType<typeof FileEditor>>()

function onFileChanged(file: string) {
  editorRef.value?.reloadCurrentFile(file)
}
</script>
