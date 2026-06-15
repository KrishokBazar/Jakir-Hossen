/**
 * Generates a pre-filled WhatsApp link to contact the application admin.
 *
 * @param name - The registering operator's name
 * @param phone - The registering operator's phone number
 * @param address - The registering operator's home/store address
 * @returns The fully constructed WhatsApp API web link
 */
export function constructWhatsAppAdminNotificationUrl(
  name: string,
  phone: string,
  address: string
): string {
  const adminPhone = "8801931355398"; // Hardcoded system admin phone number
  const cleanPhone = phone.trim();
  const cleanName = name.trim();
  const cleanAddress = address.trim();

  const textMessage = `আসসালামু আলাইকুম, আমি কৃষক বাজার অপারেটর পোর্টালে নিবন্ধন করেছি।\n\n` +
    `নাম: ${cleanName}\n` +
    `মোবাইল: ${cleanPhone}\n` +
    `ঠিকানা: ${cleanAddress}\n\n` +
    `দয়া করে আমার অ্যাকাউন্টটি অনুমোদন করবেন। ধন্যবাদ!`;

  return `https://wa.me/${adminPhone}?text=${encodeURIComponent(textMessage)}`;
}
