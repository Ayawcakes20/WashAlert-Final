import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { support } from '../../services/api';

const QUICK_REPLIES = [
  'How much is wash and dry?',
  'How long does laundry take?',
  'Where is my order?',
  'Do you offer delivery?',
  'What are your branches?',
  'Payment methods?',
];

const TRACKING_RE = /WA-\d+/i;

const ChatScreen = ({ navigation }) => {
  const scrollRef = useRef();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi! I'm IkotAsk, your WashAlert assistant. How can I help you today?", sender: 'bot', time: 'Just now' },
  ]);

  const msgId = useRef(2);

  const sendMessage = async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;

    const userMsg = { id: msgId.current++, text: trimmed, sender: 'user', time: 'Just now' };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    let reply = 'Support service is temporarily unavailable. Please try again or ask for staff assistance.';

    try {
      const tracking = TRACKING_RE.exec(trimmed)?.[0]?.toUpperCase();
      const payload = await support.chat(trimmed, tracking);
      if (payload?.reply) {
        reply = payload.reply;
      }
    } catch {
      reply = 'Support service is temporarily unavailable. Please try again or ask for staff assistance.';
    } finally {
      setIsTyping(false);
    }

    const botMsg = { id: msgId.current++, text: reply, sender: 'bot', time: 'Just now' };
    setMessages((prev) => [...prev, botMsg]);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerAvatar}>
            <Ionicons name="chatbubbles" size={20} color={colors.accent} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>IkotAsk</Text>
            <Text style={styles.headerOnline}>Online</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.msgRow, msg.sender === 'user' ? styles.msgRowUser : styles.msgRowBot]}>
              {msg.sender === 'bot' && (
                <View style={[styles.avatarBox, { backgroundColor: 'hsla(174, 79%, 44%, 0.1)' }]}>
                  <Ionicons name="chatbubbles" size={12} color={colors.accent} />
                </View>
              )}

              <View style={[styles.msgBubble, msg.sender === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.msgText, msg.sender === 'user' ? styles.msgTextUser : styles.msgTextBot]}>{msg.text}</Text>
              </View>

              {msg.sender === 'user' && (
                <View style={[styles.avatarBox, { backgroundColor: 'hsla(224, 82%, 48%, 0.1)' }]}>
                  <Ionicons name="person" size={12} color={colors.primary} />
                </View>
              )}
            </View>
          ))}
          {isTyping && (
            <View style={[styles.msgRow, styles.msgRowBot]}>
              <View style={[styles.avatarBox, { backgroundColor: 'hsla(174, 79%, 44%, 0.1)' }]}>
                <Ionicons name="chatbubbles" size={12} color={colors.accent} />
              </View>
              <View style={[styles.msgBubble, styles.bubbleBot]}>
                <Text style={styles.msgTextBot}>Typing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.quickRepliesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {QUICK_REPLIES.map((q) => (
              <TouchableOpacity key={q} style={styles.qrBtn} onPress={() => void sendMessage(q)}>
                <Text style={styles.qrText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputBox}>
          <TextInput
            style={styles.inputField}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => void sendMessage(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            disabled={!input.trim()}
            onPress={() => void sendMessage(input)}
          >
            <Ionicons name="send" size={16} color={colors.card} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardWrap: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'hsla(174, 79%, 44%, 0.1)', alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  headerOnline: { fontSize: 10, fontWeight: 'bold', color: colors.success },

  chatArea: { flex: 1 },
  chatContent: { padding: 16, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },

  avatarBox: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  msgBubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 12 },
  bubbleUser: { backgroundColor: colors.primary, borderRadius: 16, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextUser: { color: colors.card },
  msgTextBot: { color: colors.text },

  quickRepliesWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  qrBtn: { backgroundColor: 'hsla(224, 82%, 48%, 0.05)', borderWidth: 1, borderColor: 'hsla(224, 82%, 48%, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginRight: 8 },
  qrText: { color: colors.primary, fontSize: 12, fontWeight: '500' },

  inputBox: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  inputField: { flex: 1, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, fontSize: 14, color: colors.text },
  sendBtn: { width: 44, height: 44, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
});

export default ChatScreen;
