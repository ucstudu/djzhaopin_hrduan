import { MessageRecord } from "@/services/types";
import { ElMessage } from "element-plus";
import Stomp from "stompjs";

const VITE_BASE_URL = import.meta.env.VITE_BASE_URL as string;

const socket = new WebSocket(`${VITE_BASE_URL.replace(/^http/, "ws")}/ws`);
const stompClient = Stomp.over(socket);

const messageIds = new Set<string>();

let mainStore: any;
let messageStore: any;

// @ts-ignore
// stompClient.debug = null;

export const connectStomp = (
  _mainStore: { jsonWebToken: string },
  _messageStore: {
    messages: {
      [x: string]: {
        haveRead: boolean;
        content: string;
        createdAt: string;
        initiateId: string;
        initiateType: number;
        messageRecordId: string;
        messageType: 1 | 2 | 3 | 4;
        serviceId: string;
        serviceType: number;
        updatedAt: string;
      }[];
    };
  }
) => {
  mainStore = _mainStore;
  messageStore = _messageStore;
  stompClient.connect(
    { Authorization: "Bearer " + _mainStore.jsonWebToken },
    (frame) => {
      stompClient.subscribe("/user/queue/message", (message) => {
        // 每接收到一次消息都会触发这个回调
        // @ts-ignore
        if (!messageIds.has(message.headers["message-id"])) {
          const data = JSON.parse(message.body) as {
            body: MessageRecord[];
            message: string;
            status: number;
            timestamp: string;
          };
          for (const messageRecord of data.body) {
            if (!_messageStore.messages[messageRecord.initiateId]) {
              _messageStore.messages[messageRecord.initiateId] = [];
            }
            _messageStore.messages[messageRecord.initiateId].push({
              ...messageRecord,
              haveRead: false,
            });
          }
          if (data.body.length > 0) {
            ElMessage.success({
              message: `你收到了${data.body.length}条新的消息`,
            });
          }
        }
        if (messageIds.size > 10) {
          messageIds.clear();
        }
      });
      stompClient.subscribe("/user/queue/error", (errors) => {
        // 每接收到一次消息都会触发这个回调
        const data = JSON.parse(errors.body) as {
          errors: any;
          message: string;
          status: number;
          timestamp: string;
        };
      });
      setInterval(() => {
        stompClient.send(
          "/ping",
          {},
          JSON.stringify({
            timestamp: new Date().toISOString(),
          })
        );
      }, 30000);
    },
    handleDisconnect
  );
};

const handleDisconnect = () => {
  connectStomp(mainStore, messageStore);
};

// 发送消息
export const sendMessage = (
  content: string,
  messageType: 1 | 2 | 3 | 4,
  serviceId: string,
  serviceType: number
) => {
  const message = {
    content,
    initiateId: mainStore.accountInformation.fullInformationId,
    initiateType: 2,
    messageType,
    serviceId,
    serviceType,
  };
  stompClient.send("/message", {}, JSON.stringify(message));
  if (!messageStore.messages[serviceId]) {
    messageStore.messages[serviceId] = [];
  }
  messageStore.messages[serviceId].push({
    ...message,
    haveRead: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageRecordId: "",
  });
};
