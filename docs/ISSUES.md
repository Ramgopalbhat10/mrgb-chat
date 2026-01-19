# Issues

## 01 ChatView Component Issues

### Duplicate User Message
**Status:** Fixed
- When a new chat is selected and a first message is sent, the UI is displaying the user message twice.
- Once the response streaming is completed, the UI will remove the duplicate user message.

### 02 Scroll-to-bottom Indicator Issue
**Status:** Fixed
- Let's say there are only two messages - user input and response. When the response is regenerated, the scroll-to-bottom indicator is still visible at the top of the message list.

### 03 Scroll Issue
**Status:** Fixed
- When streaming response is generated and the user scrolls to some position in the response, the scroll position is lost after the response is completed. It is scrolling up to the top of the current response. The scroll position should be preserved.