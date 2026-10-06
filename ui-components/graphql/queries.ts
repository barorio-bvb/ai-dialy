/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getTodo = /* GraphQL */ `
  query GetTodo($id: ID!) {
    getTodo(id: $id) {
      aiComment
      content
      createdAt
      id
      imageUrl
      rawMemo
      updatedAt
      __typename
    }
  }
`;
export const listTodoByCreatedAt = /* GraphQL */ `
  query ListTodoByCreatedAt(
    $createdAt: AWSDateTime!
    $filter: ModelTodoFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listTodoByCreatedAt(
      createdAt: $createdAt
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        aiComment
        content
        createdAt
        id
        imageUrl
        rawMemo
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const listTodos = /* GraphQL */ `
  query ListTodos(
    $filter: ModelTodoFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listTodos(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        aiComment
        content
        createdAt
        id
        imageUrl
        rawMemo
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
