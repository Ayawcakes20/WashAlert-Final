package com.washalert.washalertbackend.announcement;

import com.washalert.washalertbackend.user.User;

import java.util.List;

public interface AnnouncementNotificationGateway {
    void dispatchInApp(Announcement announcement, List<User> recipients);
    void dispatchPush(Announcement announcement, List<User> recipients);
    void dispatchSms(Announcement announcement, List<User> recipients);
}
