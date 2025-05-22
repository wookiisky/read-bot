# Read Bot - Chrome 插件项目文档

## 1. 项目概述

Read Bot 是一款 Chrome 扩展程序，旨在帮助用户通过大型语言模型 (LLM) 与当前浏览的网页内容进行对话。它提取网页文本，允许用户通过聊天界面与 LLM 互动，并支持多种内容提取方式和 LLM 服务。

**核心特性:**

*   **网页内容提取与交互**: 自动提取网页内容，并以此为上下文与 LLM 对话。
*   **多 LLM 支持**: 灵活切换和配置不同的 LLM 服务 (Gemini, OpenAI 兼容 API)。
*   **多种提取方式**: 支持 Jina AI, Download API, Readability.js 等内容提取方法。
*   **侧边栏式 UI**: 侧边栏设计，紧凑美观，操作便捷，切换标签页时自动更新内容。
*   **数据持久化**: 缓存页面内容和对话历史，提升体验。
*   **配置同步**: 用户配置跨浏览器自动同步。
*   **高度模块化**: 易于扩展和维护。
*   **调试友好**: 清晰的日志输出。

## 2. UI 设计

Read Bot 采用极简风格，漂亮现代的设计，以侧边栏形式展示，确保用户在浏览网页时能够方便地与之交互。


**UI 布局:**

1.  **主容器 (侧边栏)**:
    *   固定在浏览器窗口一侧（通常是右侧）。
    *   当用户切换浏览器标签页时，侧边栏内容（提取的网页内容、对话）会相应地更新，以匹配新激活的页面。
    *   使用 Chrome 的原生侧边栏 API 实现，提供更好的集成体验。

2.  **最上方：页面内容提取区**:
    *   **内容显示**:
        *   打开扩展或切换到新页面时，自动开始提取当前页面的核心内容，并转换为 Markdown 格式。
        *   直接显示完整的 Markdown 内容。如果内容过长，该区域会出现滚动条。
    *   **提取方式切换**:
        *   右上角排列2个图标按钮，例如：
            *   Jina AI 图标: 代表 Jina AI 提取方式。
            *   下载 图标: 代表 Download API 提取方式。
            *   (Readability.js 可以作为默认或备用，不一定需要独立切换图标，或者在设置中配置优先级)
        *   点击图标可立即尝试使用对应方式重新提取当前页面内容。
        *   当前激活的提取方式应有高亮或其他视觉提示。

3.  **中间：快捷输入区**:
    *   一行或多行可配置的快捷输入按钮。
    *   每个按钮上显示预设的文本（例如："总结内容"，"翻译成英文"）。
    *   点击按钮，会将预设的实际发送文本（可能包含 `{CONTENT}` 占位符）填入下方输入框或直接发送。

4.  **下方：Chat 界面**:
    *   **对话记录区**:
        *   以聊天气泡形式展示用户和 Bot 的对话历史。
        *   Bot 的回复支持 Markdown 格式渲染（包括代码块、列表、加粗等）。
        *   支持 LLM 的流式输出，消息会逐渐显示。
    *   **输入框**:
        *   多行文本输入框，用于用户输入问题或指令。
        *   支持 `Shift+Enter` 换行，`Enter` 发送。
        *   支持粘贴图片。粘贴后，图片会以缩略图形式展示在输入框上方或附加区域，并随消息一起发送给多模态 LLM。
    *   **操作按钮**:
        *   **发送按钮**: 点击发送输入框中的内容。
        *   **对话导出按钮**: (例如一个下载图标) 点击后，将当前对话历史导出为 Markdown 文件。

## 3. 项目结构

```
read-bot/
├── manifest.json               # 扩展清单文件
├── icons/                      # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/                      # 侧边栏 UI (使用 Chrome 侧边栏 API)
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                    # 配置页面 UI
│   ├── options.html
│   ├── options.css
│   └── options.js
├── background/
│   └── service-worker.js       # 后台服务脚本 (Manifest V3)
├── content_scripts/
│   └── content_script.js       # 内容脚本，用于与页面交互
├── js/
│   ├── lib/                    # 第三方库 (如 marked.js, DOMPurify, Readability.js)
│   │   ├── marked.min.js
│   │   └── Readability.js
│   ├── modules/                # 核心功能模块
│   │   ├── storage.js          # 数据存储管理
│   │   ├── content_extractor.js # 页面内容提取逻辑
│   │   ├── llm_service.js      # LLM API 调用逻辑
│   │   ├── config_manager.js   # 配置管理
│   │   ├── ui_updater.js       # UI 更新辅助模块 (可选，部分逻辑可在 popup.js)
│   │   └── logger.js           # 日志模块
│   └── utils.js                # 通用工具函数
└── _locales/                   # 国际化支持 (可选)
    ├── en/
    │   └── messages.json
    └── zh_CN/
        └── messages.json
```

## 4. 模块和文件功能逻辑

### 4.1. `manifest.json`

*   **功能**: 扩展的入口点和配置中心。
*   **逻辑**:
    *   定义扩展名称、版本、描述、图标。
    *   声明权限:
        *   `storage`: 用于本地存储和同步存储。
        *   `activeTab`: 获取当前活动标签页信息。
        *   `scripting`: 动态注入脚本到页面。
        *   `sidePanel`: 使用 Chrome 侧边栏 API。
        *   `contextMenus`: (可选) 如果需要右键菜单触发。
        *   `notifications`: (可选) 用于显示通知。
        *   `alarms`: (可选) 用于定时任务。
        *   Host permissions (`<all_urls>` 或特定域名): 访问 Jina AI 等外部服务，或 Download API (如果需要)。
    *   注册 `service-worker.js` (background script)。
    *   配置 `side_panel` 属性（指定侧边栏的 HTML 路径）。
    *   注册 `options_page` (options_ui)。
    *   配置 `content_scripts` (如果需要主动注入)。

### 4.2. `background/service-worker.js`

*   **功能**: 扩展的后台核心逻辑处理，事件监听。
*   **逻辑**:
    *   **事件监听**:
        *   `chrome.runtime.onInstalled`: 初始化默认配置，设置右键菜单（如果需要），初始化侧边栏设置。
        *   `chrome.runtime.onMessage`: 接收来自 `popup.js` 和 `content_script.js` 的消息，并分发处理。
        *   `chrome.tabs.onActivated`: 监听标签页切换事件，通知侧边栏更新 UI。
        *   `chrome.tabs.onUpdated`: 监听标签页 URL 变化等，通知侧边栏更新或重新提取内容。
    *   **侧边栏初始化**:
        *   设置 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 使点击扩展图标时打开侧边栏。
    *   **核心业务逻辑**:
        *   **内容提取协调**: 接收提取请求，调用 `content_extractor.js`，将结果返回给请求方。
        *   **LLM 调用**: 接收对话请求，调用 `llm_service.js`，处理流式响应并转发给侧边栏。
        *   **数据管理**: 与 `storage.js` 交互，保存和读取页面内容及对话历史。
        *   **配置管理**: 与 `config_manager.js` 交互，获取 LLM Key、模型配置等。
    *   **状态管理**: 维护少量必要的全局状态（例如当前活动 Tab 的 URL 和提取状态）。
    *   **日志**: 使用 `logger.js` 记录关键操作和错误。

### 4.3. `content_scripts/content_script.js`

*   **功能**: 注入到网页中，用于提取原始 HTML 或执行 Readability.js。
*   **逻辑**:
    *   监听来自 `service-worker.js` 或 `popup.js` 的消息，请求提取页面内容。
    *   **Readability.js 执行**: 如果选择 Readability.js 方式，在此脚本中执行 `new Readability(document.cloneNode(true)).parse()`，并将结果发送回 `service-worker.js`。
    *   **发送页面信息**: 可将 `document.documentElement.outerHTML` 或 `document.body.innerText` 等信息发送给 `service-worker.js`，供其他提取方式使用。
    *   **日志**: 少量关键日志。

### 4.4. `popup/popup.html`

*   **功能**: 侧边栏的 HTML 结构。
*   **逻辑**: 定义页面内容提取区、快捷输入区、Chat 界面的静态布局。

### 4.5. `popup/popup.css`

*   **功能**: 侧边栏的样式。
*   **逻辑**: 实现极简、紧凑、美观的视觉效果。响应式设计（如果侧边栏宽度可调）。

### 4.6. `popup/popup.js`

*   **功能**: 侧边栏的交互逻辑和动态内容渲染。
*   **逻辑**:
    *   **初始化**:
        *   DOM 加载完成后，获取当前活动标签页 URL。
        *   向 `service-worker.js` 发送消息，请求加载该 URL 对应的缓存内容和对话历史。
        *   向 `service-worker.js` 请求加载用户配置的快捷输入。
        *   渲染快捷输入按钮。
    *   **事件监听**:
        *   监听 `service-worker.js` 关于标签页切换/更新的通知，重新请求数据并更新 UI。
        *   监听内容提取方式切换按钮的点击事件，向 `service-worker.js` 发送重新提取内容的请求。
        *   监听快捷输入按钮点击事件，获取实际发送文本，替换 `{CONTENT}` 占位符，然后调用发送消息逻辑。
        *   监听聊天输入框的发送事件（回车或点击发送按钮）。
        *   监听图片粘贴事件 (`paste`) 到输入框，读取图片数据。
        *   监听对话导出按钮点击事件。
    *   **UI 更新**:
        *   **内容展示**: 接收并展示从 `service-worker.js` 获取的提取内容（Markdown 格式）。如果内容过长，则通过滚动条显示。
        *   **对话渲染**:
            *   将用户消息添加到对话记录区。
            *   接收 `service-worker.js` 转发的 LLM 流式响应，实时更新 Bot 回复气泡。
            *   使用 `marked.min.js` (配合 `DOMPurify` 清理) 将 Markdown 渲染为 HTML。
    *   **消息发送**:
        *   收集用户输入、当前对话历史、提取的页面内容（可选，根据 LLM 是否需要）、粘贴的图片数据（Base64）。
        *   将数据发送给 `service-worker.js` 进行 LLM 调用。
        *   清空输入框。
    *   **对话导出**:
        *   收集当前对话记录。
        *   格式化为 Markdown 文本。
        *   触发浏览器下载 `.md` 文件。
    *   **日志**: 使用 `logger.js` 记录用户交互和关键流程。

### 4.7. `options/options.html` & `options.css` & `options.js`

*   **功能**: 提供用户配置界面。
*   **逻辑 (`options.js`)**:
    *   **加载配置**: 页面加载时，通过 `config_manager.js` (可能通过 `service-worker.js` 消息传递，或直接调用 `chrome.storage.sync`) 获取当前配置并填充到表单。
    *   **保存配置**: 用户修改表单内容后，点击保存按钮时，收集表单数据，通过 `config_manager.js` 保存配置。
    *   **UI 交互**: 动态添加/删除 LLM 供应商配置、快捷输入项。
    *   **表单校验**: 对 API Key、URL 等格式进行基本校验。
    *   **日志**: 记录配置加载和保存操作。

### 4.8. `js/modules/storage.js`

*   **功能**: 封装浏览器本地存储 (`chrome.storage.local`) 操作，用于缓存页面内容和对话历史。
*   **逻辑**:
    *   `DB_KEY_PREFIX = "readBotCache_"`
    *   `MAX_ITEMS = 20` (最近的20条记录)
    *   `savePageData(url, { content: extractedMarkdown, chatHistory: [] })`:
        *   使用 URL 作为主键。
        *   保存页面提取内容和对话历史。
        *   实现 LRU (Least Recently Used) 策略：如果超过 `MAX_ITEMS`，移除最旧的条目。需要维护一个访问顺序列表。
    *   `getPageData(url)`: 根据 URL 获取缓存数据。获取后更新其在 LRU 列表中的位置。
    *   `updateChatHistory(url, newMessages)`: 追加或替换指定 URL 的对话历史。
    *   `getRecentUrls()`: 获取最近访问的 URL 列表（用于 LRU）。
    *   **日志**: 记录存储、读取、删除操作。

### 4.9. `js/modules/content_extractor.js`

*   **功能**: 封装多种网页内容提取逻辑。
*   **逻辑**:
    *   `async extract(url, htmlString, method, config)`:
        *   `method`: 'jina', 'downloadApi', 'readability'
        *   `config`: 包含如 Jina AI Key 等必要配置。
        *   根据 `method` 调用相应的私有提取函数。
    *   `_extractWithJina(url, apiKey)`:
        *   构造 Jina AI API 请求 (`https://r.jina.ai/{url}` or `https://s.jina.ai/`)。
        *   设置 `Authorization: Bearer ${apiKey}` 或 `x-api-key` Header。
        *   处理 API 响应，返回 Markdown 内容。
        *   错误处理和日志。
    *   `_extractWithDownloadApi(url, apiEndpoint)`:
        *   构造自定义 Download API 请求 (`${apiEndpoint}?url=${encodeURIComponent(url)}`)。
        *   处理 API 响应，返回 Markdown 内容。
        *   错误处理和日志。
    *   `_extractWithReadability(htmlString)`:
        *   如果 `htmlString` 未提供，则需要一种方式从 `content_script.js` 获取。
        *   使用 `Readability.js` 库解析 `htmlString`。
        *   将解析后的 `article` 内容转换为 Markdown (可以使用 Turndown.js 或简化版手动转换)。
        *   错误处理和日志。
    *   **日志**: 记录每次提取尝试的方法、URL 和结果（成功/失败）。

### 4.10. `js/modules/llm_service.js`

*   **功能**: 封装对不同 LLM API 的调用。
*   **逻辑**:
    *   `async callLLM(messages, llmConfig, systemPrompt, imageBase64, streamCallback, doneCallback, errorCallback)`:
        *   `messages`: 对话历史数组，格式如 `[{role: "user", content: "Hello"}, {role: "assistant", content: "Hi there!"}]`。
        *   `llmConfig`: 对象，包含 `provider` ('gemini', 'openai'), `modelName`, `apiKey`, `baseUrl`。
        *   `systemPrompt`: 系统提示词。
        *   `imageBase64`: 可选，Base64 编码的图片数据。
        *   `streamCallback(chunk)`: 用于流式输出，每接收到一块数据就调用。
        *   `doneCallback(fullResponse)`: 完成时调用。
        *   `errorCallback(error)`: 发生错误时调用。
    *   根据 `llmConfig.provider` 选择对应的处理函数：
        *   **Gemini**:
            *   构造 Gemini API 请求体 (包含 `contents`, `generationConfig`)。
            *   处理多模态数据（文本和图片）。
            *   使用 `fetch` 调用 Google AI Gemini API (`generativelanguage.googleapis.com`)。
            *   处理流式响应 (`alt=sse`) 或非流式响应。
        *   **OpenAI-compatible**:
            *   构造 OpenAI API 请求体 (包含 `model`, `messages`, `stream: true`, `max_tokens` 等)。
            *   如果 `imageBase64` 存在且模型支持，构建多模态消息体。
            *   使用 `fetch` 调用 API ( `llmConfig.baseUrl` + `/v1/chat/completions`)。
            *   处理流式响应 (Server-Sent Events)。
    *   **流式响应处理**:
        *   使用 `ReadableStream` 和 `TextDecoder` 解析 SSE。
        *   解析 `data: {...}` 事件，提取内容 `chunk`，调用 `streamCallback`。
        *   处理 `[DONE]` 标记。
    *   **错误处理**: 捕获网络错误、API 错误，并调用 `errorCallback`。
    *   **日志**: 记录 API 请求参数（脱敏 Key）、响应状态、错误信息。

### 4.11. `js/modules/config_manager.js`

*   **功能**: 管理用户配置的加载和保存，使用 `chrome.storage.sync` 实现跨浏览器同步。
*   **逻辑**:
    *   `STORAGE_KEY = "readBotConfig"`
    *   `getDefaultConfig()`: 返回一个包含所有默认配置的对象结构。
        ```javascript
        {
            defaultExtractionMethod: 'readability', // 'jina', 'downloadApi'
            jinaApiKey: '',
            downloadApiEndpoint: '', // 用户自己的 download API 服务地址
            llm: {
                defaultProvider: 'openai', // 'gemini'
                providers: {
                    openai: {
                        apiKey: '',
                        baseUrl: 'https://api.openai.com', // 允许修改为兼容API
                        model: 'gpt-3.5-turbo'
                    },
                    gemini: {
                        apiKey: '',
                        model: 'gemini-pro' // or gemini-pro-vision for multimodal
                    }
                    // 可以扩展更多 providers
                }
            },
            systemPrompt: 'You are a helpful assistant. The user is interacting with content from a webpage. The extracted content is provided below:\n{CONTENT}\n\nAnswer the user\'s questions based on this content and your general knowledge.',
            quickInputs: [
                { displayText: '总结内容', sendText: 'Please summarize the following content:\n{CONTENT}' },
                { displayText: '提取要点', sendText: 'Extract key points from this content:\n{CONTENT}' }
            ],
            contentDisplayHeight: 300 // 控制提取页面内容展示区域的高度
        }
        ```
    *   `async getConfig()`:
        *   从 `chrome.storage.sync.get(STORAGE_KEY)` 获取配置。
        *   如果未找到或部分缺失，与 `getDefaultConfig()` 合并，确保所有字段存在。
        *   返回配置对象。
    *   `async saveConfig(newConfig)`:
        *   将 `newConfig` 保存到 `chrome.storage.sync.set({ [STORAGE_KEY]: newConfig })`。
    *   **日志**: 记录配置加载和保存操作。

### 4.12. `js/modules/logger.js`

*   **功能**: 提供一个简单的日志记录工具，方便控制日志级别和输出格式。
*   **逻辑**:
    *   `LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 }`
    *   `currentLogLevel = LOG_LEVELS.INFO` (可以从 `chrome.storage.local` 读取，方便调试时修改)
    *   `log(level, moduleName, ...args)`:
        *   如果 `level >= currentLogLevel`，则输出日志。
        *   格式: `[TIMESTAMP] [LEVEL_STRING] [ModuleName] - message`
        *   例如: `logger.info('Popup.js', 'User clicked send button')`
    *   便捷方法: `debug()`, `info()`, `warn()`, `error()`。

### 4.13. `js/utils.js`

*   **功能**: 存放通用的辅助函数。
*   **逻辑**:
    *   `generateUniqueId()`: 生成唯一 ID (用于消息等)。
    *   `sanitizeHtml(htmlString)`: 使用 `DOMPurify` 清理 HTML，防止 XSS。
    *   `debounce(func, delay)` / `throttle(func, limit)`: 防抖和节流函数。
    *   `isValidUrl(string)`: URL 格式校验。
    *   `markdownToText(markdown)`: 简单地将 Markdown 转为纯文本（用于摘要或发送给不支持 Markdown 的模型）。

## 5. 交互流程

### 5.1. 首次打开扩展/切换标签页

1.  **用户操作**: 点击扩展图标或切换到新的浏览器标签页。
2.  **`popup.js`**:
    *   若为图标点击，popup 打开。
    *   通过 `chrome.tabs.query({active: true, currentWindow: true})` 获取当前活动标签页 URL。
    *   向 `service-worker.js` 发送消息 ` { type: 'GET_PAGE_DATA', url: currentUrl }`。
3.  **`service-worker.js`**:
    *   接收消息，调用 `storage.js` 的 `getPageData(currentUrl)`。
    *   **缓存命中**:
        *   将缓存的 `{ content, chatHistory }` 通过消息 ` { type: 'PAGE_DATA_LOADED', data: cacheData }` 返回给 `popup.js`。
    *   **缓存未命中/内容为空**:
        *   调用 `config_manager.js` 获取默认提取方式和相关 API Key。
        *   调用 `content_extractor.js` 的 `extract(currentUrl, null, defaultMethod, config)` (HTML 内容可后续由 `content_script.js` 提供或 Jina/Download API 自行获取)。
        *   **提取成功**:
            *   调用 `storage.js` 的 `savePageData(currentUrl, { content: extractedContent, chatHistory: [] })`。
            *   将 `{ content: extractedContent, chatHistory: [] }` 返回给 `popup.js`。
        *   **提取失败**:
            *   记录错误日志。
            *   返回空内容或错误信息给 `popup.js` ` { type: 'PAGE_DATA_ERROR', error: 'Failed to extract' }`。
4.  **`popup.js`**:
    *   接收 `PAGE_DATA_LOADED` 或 `PAGE_DATA_ERROR` 消息。
    *   更新 UI：在内容区显示提取的内容（或错误提示），在对话区加载历史对话。
    *   加载并显示快捷输入按钮。

### 5.2. 用户发送消息 (包含图片)

1.  **用户操作**: 在输入框输入文本，可能粘贴了图片，点击发送。
2.  **`popup.js`**:
    *   获取输入框文本、当前对话历史、当前已提取的页面内容 (`extractedPageContent`)。
    *   如果粘贴了图片，将图片转换为 Base64 字符串 (`imageBase64`)。
    *   构建消息历史 `messages` 数组。
    *   向 `service-worker.js` 发送消息 ` { type: 'SEND_LLM_MESSAGE', payload: { messages, systemPromptTemplate, extractedPageContent, imageBase64, currentUrl } }`。
    *   将用户消息立即显示在对话区。清空输入框。
3.  **`service-worker.js`**:
    *   接收消息。调用 `config_manager.js` 获取当前 LLM 配置 (API Key, model, provider, base URL) 和系统提示词模板。
    *   用 `extractedPageContent` 替换系统提示词中的 `{CONTENT}` 占位符，得到最终的 `systemPrompt`。
    *   将 `systemPrompt` 作为第一条 `system` 角色的消息加入 `messages` (如果 LLM 支持)。
    *   调用 `llm_service.js` 的 `callLLM(messages, llmConfig, finalSystemPrompt, imageBase64, streamCb, doneCb, errorCb)`。
    *   **`streamCb(chunk)`**: 每当 `llm_service.js` 返回数据块，`service-worker.js` 将其通过消息 ` { type: 'LLM_STREAM_CHUNK', chunk }` 发送给 `popup.js`。
    *   **`doneCb(fullResponse)`**: LLM 响应完成。
        *   将完整的 Bot 回复和用户消息一起更新到 `storage.js` 中对应 URL 的对话历史。
        *   向 `popup.js` 发送消息 ` { type: 'LLM_STREAM_END', fullResponse }`。
    *   **`errorCb(error)`**: LLM 调用出错。
        *   记录错误日志。
        *   向 `popup.js` 发送消息 ` { type: 'LLM_ERROR', error }`。
4.  **`popup.js`**:
    *   接收 `LLM_STREAM_CHUNK`：将 `chunk` 追加到 Bot 的当前回复气泡中，实现流式显示。
    *   接收 `LLM_STREAM_END`：标记 Bot 回复完成。
    *   接收 `LLM_ERROR`：在对话区显示错误信息。

### 5.3. 切换内容提取方式

1.  **用户操作**: 点击内容提取区的 Jina AI 或 Download API 图标。
2.  **`popup.js`**:
    *   获取当前活动标签页 URL。
    *   获取被点击的提取方式 `newMethod`。
    *   向 `service-worker.js` 发送消息 ` { type: 'RE_EXTRACT_CONTENT', url: currentUrl, method: newMethod }`。
    *   UI 上可以显示一个加载状态。
3.  **`service-worker.js`**:
    *   接收消息。调用 `config_manager.js` 获取对应提取方式的配置 (如 Jina API Key)。
    *   调用 `content_extractor.js` 的 `extract(currentUrl, null, newMethod, config)`。
    *   **提取成功**:
        *   调用 `storage.js` 更新该 URL 的 `content`。
        *   将新的 `extractedContent` 通过消息 ` { type: 'CONTENT_UPDATED', content: newContent }` 返回给 `popup.js`。
    *   **提取失败**:
        *   记录错误日志。
        *   返回错误信息给 `popup.js` ` { type: 'CONTENT_UPDATE_ERROR', error: 'Failed to re-extract' }`。
4.  **`popup.js`**:
    *   接收 `CONTENT_UPDATED` 或 `CONTENT_UPDATE_ERROR` 消息。
    *   更新内容区的显示。清除加载状态。

### 5.4. 保存/加载配置

1.  **用户操作 (保存)**: 在 `options.html` 页面修改配置，点击保存。
2.  **`options.js`**:
    *   收集表单所有配置数据 `newConfig`。
    *   调用 `config_manager.js` (或通过 `service-worker.js` 转发) 的 `saveConfig(newConfig)`。
    *   `config_manager.js` 使用 `chrome.storage.sync.set` 保存。
    *   显示保存成功提示。
3.  **用户操作 (加载)**: 打开 `options.html` 页面。
4.  **`options.js`**:
    *   调用 `config_manager.js` (或通过 `service-worker.js` 转发) 的 `getConfig()`。
    *   `config_manager.js` 使用 `chrome.storage.sync.get` 加载，并与默认配置合并。
    *   用获取到的配置数据填充 `options.html` 页面的表单。

## 6. Debug 与日志

*   **`logger.js`**: 所有模块都应使用此模块进行日志记录。
    *   `logger.debug(...)`: 用于详细的开发者调试信息。
    *   `logger.info(...)`: 用于关键流程和状态变化。
    *   `logger.warn(...)`: 用于潜在问题或非致命错误。
    *   `logger.error(...)`: 用于捕获到的错误和异常。
*   **日志级别控制**: 可以在 `logger.js` 中设置全局 `currentLogLevel`。更高级的做法是从 `chrome.storage.local` 读取一个调试标志来动态调整日志级别，方便在已发布的扩展中开启详细日志进行故障排查。
*   **控制台**:
    *   **Popup**: 右键点击扩展图标，选择 "检查弹出视图"。
    *   **Service Worker**: 在 `chrome://extensions` 页面，找到 Read Bot，点击 "服务工作线程" (Service Worker) 链接。
    *   **Content Script**: 在注入的网页上打开开发者工具 (F12)，在其控制台查看。
    *   **Options Page**: 打开选项页面，然后打开开发者工具 (F12)。
*   **错误边界**: 在关键的异步操作和事件处理中使用 `try...catch`，并用 `logger.error` 记录捕获的异常。
*   **消息传递**: 记录所有 `chrome.runtime.sendMessage` 和 `chrome.tabs.sendMessage` 的内容以及接收方的处理情况，便于追踪问题。

## 7. 扩展性考虑

*   **添加新的 LLM**:
    1.  在 `js/modules/llm_service.js` 中添加新的私有处理函数 (如 `_callMyNewLlmApi(...)`)。
    2.  在 `callLLM` 主函数中增加对新 `provider` 类型的分支处理。
    3.  在 `js/modules/config_manager.js` 的 `getDefaultConfig()` 中为新 LLM 添加配置结构。
    4.  更新 `options.html` 和 `options.js` 以支持新 LLM 的配置界面。
*   **添加新的内容提取方式**:
    1.  在 `js/modules/content_extractor.js` 中添加新的私有提取函数 (如 `_extractWithMyNewMethod(...)`)。
    2.  在 `extract` 主函数中增加对新 `method` 类型的分支处理。
    3.  在 `js/modules/config_manager.js` 的 `getDefaultConfig()` 中为新提取方式添加相关配置（如果需要 API Key 等）。
    4.  更新 `options.html` 和 `options.js` 以配置新提取方式。
    5.  (可选) 在 `popup.html` 和 `popup.js` 中添加新的切换图标和逻辑。

## 8. 未来可能的功能

*   右键菜单快速启动对话。
*   选择网页部分文本进行对话。
*   更精细的对话历史管理（搜索、删除单条）。
*   支持更多多模态输入（如音频）。
*   提供更多内置的 Prompt 模板。

## 9. 侧边栏实现总结

在Read Bot的最新版本中，我们将原有的弹出式UI（popup）改为了Chrome原生侧边栏模式。这一变更带来以下优势：

1. **持久可见性**：侧边栏可以在用户浏览网页时保持打开状态，提供更好的用户体验。
2. **标签页自动切换**：当用户切换浏览器标签页时，侧边栏内容会自动更新，显示当前页面的提取内容和相关聊天历史。
3. **更好的空间利用**：侧边栏UI针对垂直布局进行了优化，提供更合理的内容区域和聊天区域比例。
4. **原生集成**：使用Chrome提供的`sidePanel` API，可获得更好的浏览器集成体验。
5. **尺寸自动管理**：由Chrome浏览器自动管理侧边栏宽度，移除了对popupWidth和popupHeight的手动配置需求，简化了配置界面。

### 实现变更概述：

1. **Manifest.json更新**：
   - 添加`"side_panel": { "default_path": "popup/popup.html" }`配置
   - 添加`sidePanel`权限
   - 移除`default_popup`配置

2. **Background Service Worker更新**：
   - 添加侧边栏行为设置：`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`
   - 增强标签页切换和更新监听，通过消息通知侧边栏更新内容

3. **UI文件更新**：
   - 修改popup.js，改为支持侧边栏模式（无需重新加载即可更新内容）
   - 优化CSS样式，更好地适应垂直布局和自适应高度
   - 改进内容加载流程，支持在不重载界面的情况下更新内容

4. **配置简化**：
   - 移除了对popupWidth和popupHeight的配置，因为侧边栏宽度由Chrome控制
   - 保留contentDisplayHeight设置来控制内容展示区域的高度

5. **与标签页同步机制**：
   - 监听`chrome.tabs.onActivated`和`chrome.tabs.onUpdated`事件
   - 当检测到标签页变更时，向侧边栏发送消息
   - 侧边栏接收消息后，获取新标签页的URL，然后加载对应的缓存内容或执行内容提取

此升级使Read Bot成为一个更加现代化、集成度更高的Chrome扩展，提升了用户在网页浏览过程中与内容交互的体验。

