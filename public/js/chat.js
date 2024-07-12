const jwtToken = localStorage.getItem('jwt');

const socket = io('http://localhost:4000', {
    query: { token: jwtToken },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
});

let recipientUser = null;
let lastFetchedTimestamp = null;
let fetchUserStatusInterval = null;

$(document).ready(function() {
    $("#messageBody .simplebar-content-wrapper").on('scroll', function () {
        if ($("#messageBody .simplebar-content-wrapper").scrollTop() == 0) {
            console.log('Fetching messages...');
            lastFetchedTimestamp = localStorage.getItem('time');
            recipientUser = localStorage.getItem('recipient');
            socket.emit('fetch-messages', { to:recipientUser, lastFetchedTimestamp });
        }
    });
});

setInterval(() => {
    socket.emit('heartbeat');
}, 10000);

function singleChat(username) {
    if (document.getElementById(username)) {
        localStorage.removeItem('time')
        $('.chat-welcome-section').hide();
        $('.chat-loader-section').show();
        setTimeout(() => {
            $('.chat-loader-section').hide();
        }, 700);
        $('singlechatuser').addClass('user-chat-show')
        
        recipientUser = username;
        
        $('#recipientUser').text(username);
        $('.chat-conversation').show();
        $('.chat-input-section').show();
        $('#userProfileBar').css('display', 'flex');

        $('.messages__history').empty();

        localStorage.setItem('recipient', recipientUser)
        fetchMessages(recipientUser);
        fetchUserStatus(recipientUser);
    }

    scrollToBottom();
}

document.getElementById("pills-chat-tab").addEventListener("click", function () {

    document.querySelector('.user-chats1').style.display = 'block';
    document.querySelector('.user-chats2').style.display = 'none';
  
    document.querySelector(".ContactList").classList.add('d-none');
    document.querySelector(".chat-input-section form").classList.add("message_form");
    document.querySelector(".chat-input-section form").classList.remove("group_form");
    document.getElementsByClassName("chat-welcome-section")[0].style.display = "flex";
    document.getElementsByClassName("chat-conversation")[0].style.display = "none";
    document.getElementsByClassName("chat-input-section")[0].style.display = "none";
    document.getElementById("userProfileBar").style.display = "none";
    document.querySelector('.user-profile-sidebar').style.display = "none";
    document.querySelector("#chat_add").reset();
  });


$(document).ready(function() {
    $('.contact_form').on('submit', function(event) {
        event.preventDefault();
        var username = $('#username').val().trim();

        $.ajax({
            url: '/addContact',
            type: 'POST',
            dataType: 'json',
            data: {
                user: username
            },
            success: function(response) {
                // Handle success response
                fetchUsers()
                console.log('Contact added successfully:', response);
                // Optionally, you can close the modal here
                $('#addContact-exampleModal').modal('hide');
            },
            error: function(xhr, status, error) {
                console.error('Error adding contact:', error);
                var errorMessage = xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Error adding contact. Please try again.';
                $('#error_message').text(errorMessage).removeClass('d-none');
            }
        });
    });
});



function fetchUserStatus(username) {
    if (!fetchUserStatusInterval) {
        clearInterval(fetchUserStatusInterval);
    }
    fetchUserStatusInterval = setInterval(() => {
        $.ajax({
            url: `/getUserStatus/${username}`,
            method: 'GET',
            success: function(response) {
                const { last_timestamp } = response;

                if (last_timestamp) {
                    const now = Date.now();
                    const lastActiveTime = new Date(last_timestamp).getTime();
                    const isActive = now - lastActiveTime <= 10000;

                    updateRecipientStatus(isActive);
                } else {
                    console.error('Invalid last active timestamp received');
                }
            },
            error: function(err) {
                console.error('Error fetching user status:', err);
            }
        });
    }, 10000);
}

function updateRecipientStatus(isActive) {
    const recipientUserStatus = $('#recipientUserStatus');
    if (recipientUserStatus.length > 0) {
        recipientUserStatus.removeClass('offline online');
        recipientUserStatus.addClass(isActive ? 'online text-success' : 'offline');
    }
}


socket.on('fetched-messages', ({ messages, lastFetchedTimestamp }) => {
    messages.forEach(message => {
        prependMessage(message.sender_username, message.message, new Date(message.timestamp));
    });
    lastFetchedTimestamp = lastFetchedTimestamp
    localStorage.setItem('time', lastFetchedTimestamp);
});

socket.on('chat-message', ({ from, text }) => {
    appendMessage(from, text);
});

function sendMessage(message) {
    if (recipientUser) {
        socket.emit('send-message', { to: recipientUser, text: message });
    } else {
        console.error('Recipient user not selected.');
    }
}

function prependMessage(from, text, time = null) {
    if (!time) {
        time = new Date().toLocaleTimeString();
    } else {
        if (time instanceof Date && !isNaN(time)) {
            time = new Date(time).toLocaleTimeString();
        } else {
            console.error('Invalid timestamp format:', time);
            return;
        }
    }

    const currentUser = localStorage.getItem('user');
    const messageSide = from === currentUser ? 'right' : 'left';

    const messageHTML = `
        <li class="${messageSide}">
            <div class="conversation-list">
                <div class="chat-avatar">
                    <!-- Avatar or initials -->
                </div>
                <div class="user-chat-content">
                    <div class="ctext-wrap">
                        <div class="ctext-wrap-content">
                            <p>${text}</p>
                            <p class="chat-time mb-0">${time}</p>
                        </div>
                    </div>
                </div>
            </div>
        </li>
    `;

    $('.messages__history').prepend(messageHTML);
}

function appendMessage(from, text, time = null) {
    if (!time) {
        time = new Date().toLocaleTimeString();
    } else {
        if (time instanceof Date && !isNaN(time)) {
            time = new Date(time).toLocaleTimeString();
        } else {
            console.error('Invalid timestamp format:', time);
            return;
        }
    }

    const currentUser = localStorage.getItem('user');
    const messageSide = from === currentUser ? 'right' : 'left';

    const messageHTML = `
        <li class="${messageSide}">
            <div class="conversation-list">
                <div class="chat-avatar">
                    <!-- Avatar or initials -->
                </div>
                <div class="user-chat-content">
                    <div class="ctext-wrap">
                        <div class="ctext-wrap-content">
                            <p>${text}</p>
                            <p class="chat-time mb-0">${time}</p>
                        </div>
                    </div>
                </div>
            </div>
        </li>
    `;

    $('.messages__history').append(messageHTML);
    scrollToBottom();
}

function scrollToBottom() {
    const messageHistory = document.querySelector('.messages__history');
    messageHistory.scrollTop = messageHistory.scrollHeight;
}

function fetchUsers() {
    $.ajax({
        url: '/getUsers',
        method: 'GET',
        beforeSend: function() {
            $('.loader_bg').show();
        },
        success: function(users) {
            $('.loader_bg').hide();
            $('#users').empty();

            users.forEach(function(user) {
                const user_img = user.userImg && user.userImg[0] !== undefined ?
                    `<img src="assets/images/users/${user.userImg[0]}" class="rounded-circle avatar-xs" alt="">` :
                    `<div class="avatar-xs"><span class="avatar-title rounded-circle bg-soft-primary text-primary">${user.user2[0]}</span></div>`;

                const createdAt = user.createdAt ? user.createdAt : '';
                
                const userBox = `
                    <li id="${user.user2}">
                        <a href="javascript:void(0);" onclick="singleChat('${user.user2}')">
                            <div class="d-flex">                            
                                <div class="chat-user-img align-self-center me-3 ms-0">
                                    ${user_img}
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <h5 class="text-truncate font-size-15 mb-1">${user.user2}</h5>
                                    <p class="text-truncate mb-0 lh-sm"><span class="chat-user-message"></span><span class="typing"></span></p>
                                </div>
                                <div class="font-size-11 message_time">${createdAt}</div>
                            </div>
                        </a>
                    </li>
                `;

                $('#users').append(userBox);
            });
        },
        error: function(err) {
            $('.loader_bg').hide();
            console.error('Error fetching users:', err);
        }
    });
}

$(document).ready(function() {
    $('.chat-conversation').hide()
    fetchUsers();
});


function fetchMessages(to) {
    lastFetchedTimestamp = localStorage.getItem('time')
    socket.emit('fetch-messages', { to,  lastFetchedTimestamp});
    
    socket.on('fetch-messages-error', (err) => {
        console.error('Error fetching messages:', err);
    });
}


$('#sendMessageBtn').click(() => {
    const message = $('#message').val().trim();

    if (message === '') {
        $('#singleMessage').text('Please enter a message.');
        return;
    }

    $('#singleMessage').text('');
    sendMessage(message);
    $('#message').val('');
});
