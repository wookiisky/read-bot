# Read Bot 安装指南

## 安装依赖

在使用Read Bot之前，需要先下载几个依赖库：

1. **marked.js** - 用于渲染Markdown
   - 下载链接：https://cdn.jsdelivr.net/npm/marked/marked.min.js
   - 下载后保存至 `js/lib/marked.umd.js`

2. **Readability.js** - 用于提取网页内容
   - 下载链接：https://github.com/mozilla/readability
   - 你可以从该库中获取Readability.js，或者使用npm安装：
     ```bash
     npm install @mozilla/readability
     ```
   - 然后将Readability.js文件保存至 `js/lib/Readability.js`
   - 确保导出了`Readability`类：
     ```javascript
     export { Readability } from '@mozilla/readability';
     ```

## 安装扩展

### 开发模式安装

1. 打开Chrome浏览器，前往 `chrome://extensions/`
2. 在右上角开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择Read Bot项目文件夹
5. 扩展将被安装至Chrome

### 配置扩展

1. 点击扩展图标，打开选项页面
2. 填写必要的配置，如API密钥等：
   - **Jina AI API Key**：如果要使用Jina AI提取方式
   - **Download API Endpoint**：如果有自定义的下载API
   - **OpenAI API Key**：如果要使用OpenAI兼容API
   - **Gemini API Key**：如果要使用Google Gemini

## 使用说明

1. 打开任意网页
2. 点击Chrome工具栏中的Read Bot图标
3. 扩展将自动提取页面内容
4. 在聊天框中输入问题，与页面内容进行对话
5. 可以使用快捷输入按钮，快速发送常用指令
6. 可以粘贴图片到输入框，支持多模态对话（需要使用支持图片的模型）

## 故障排除

如果遇到问题：

1. 确认所有依赖库都已正确安装
2. 检查API密钥是否正确配置
3. 查看浏览器控制台中的错误信息
4. 尝试刷新页面或重新加载扩展

## 隐私说明

1. 所有页面内容和对话都存储在本地浏览器中
2. API调用会发送页面内容到选定的LLM服务
3. 没有数据会被发送到除了您配置的API服务之外的任何地方 