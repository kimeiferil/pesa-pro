import { LocalNotifications } from '@capacitor/local-notifications';

export const notificationService = {
  async requestPermission() {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  },

  async sendBudgetAlert(category: string, percentage: number, remaining: number) {
    await this.requestPermission();

    let title = '';
    let body = '';

    if (percentage >= 100) {
      title = `\u{1F534} ${category.toUpperCase()} budget exceeded!`;
      body = `You've spent 100% of your ${category} budget.`;
    } else {
      title = `\u{1F7E0} ${category.toUpperCase()} budget alert`;
      body = `You've used ${percentage}% of your ${category} budget. KES ${remaining.toLocaleString()} left.`;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 10000),
          schedule: { at: new Date(Date.now() + 1000) }, // Send now
          sound: 'default',
        }
      ]
    });
  }
};
