CREATE TABLE default_keyspace.chats (
    user1 text,
    user2 text,
    timestamp timestamp,
    chat_id uuid,
    message text,
    sender_username text,
    PRIMARY KEY ((user1, user2), timestamp, chat_id)
) WITH CLUSTERING ORDER BY (timestamp DESC, chat_id DESC)
