import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// 日記のデータ構造を定義
const schema = a.schema({
  Todo: a
    .model({
      rawMemo: a.string(),                 // ユーザーが最初に入力した「今日起きた出来事（箇条書きなど）」
      content: a.string().required(),      // AIが書き起こした（または直接入力された）日記の本文（アプリ側で500文字まで）
      imageUrl: a.string(),                // 投稿された画像のS3上のパス
      aiComment: a.string(),              // AIからの前向きなコメント
      createdAt: a.datetime()             // 作成日時
    })
    // ※ .secondaryIndexes((index) => [index('createdAt')]) は削除しました。
    //   アプリは Todo.list() で全件取得してブラウザ側で並び替えており、この索引は使っていません。
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365, // APIキーの有効期限（30日だと、1か月後にアプリが動かなくなるため最大に変更）
    },
  },
});
