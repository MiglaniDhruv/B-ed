export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "quiz" | "material" | "announcement";
  subject?: string;
  date: string;
  isRead: boolean;
}

class NotificationsStore {
  private storageKey = "notifications";

  getAllNotifications(): Notification[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  addNotification(notification: Notification): void {
    const notifications = this.getAllNotifications();
    notifications.unshift(notification);
    localStorage.setItem(this.storageKey, JSON.stringify(notifications));
  }

  markAsRead(id: string): void {
    const notifications = this.getAllNotifications().map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    localStorage.setItem(this.storageKey, JSON.stringify(notifications));
  }

  deleteNotification(id: string): void {
    const notifications = this.getAllNotifications().filter((n) => n.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(notifications));
  }
}

export const notificationsStore = new NotificationsStore();
