import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { support, BRANCH_CATALOG } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const QUICK_REPLIES = [
  'How much is wash and dry?',
  'How long does laundry take?',
  'Where is my order?',
  'Do you offer delivery?',
  'What are your branches?',
  'Payment methods?',
  'Talk to Staff',
];

const TRACKING_RE = /WA-\d+/i;

const ChatScreen = ({ navigation }) => {
  const { user } = useAuth();
  const scrollRef = useRef();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');

  const msgId = useRef(2);

  useEffect(() => {
    loadChatHistory();
    const interval = setInterval(() => {
      loadChatHistory(true);
    }, 10000); // poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadChatHistory = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      if (!isSilent) console.log('[Chat] Loading chat history...');
      const history = await support.getHistory();
      if (!isSilent) console.log('[Chat] History response:', history);
      
      if (history?.messages && history.messages.length > 0) {
        if (!isSilent) console.log('[Chat] Found', history.messages.length, 'messages');
        const loadedMessages = history.messages.map((msg, index) => ({
          id: msg.id || index + 1,
          text: msg.message,
          sender: msg.senderType === 'USER' ? 'user' : (msg.senderType === 'HUMAN' ? 'staff' : 'bot'),
          time: msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
        }));
        setMessages(loadedMessages);
        msgId.current = loadedMessages.length + 1;
      } else {
        if (!isSilent) {
          console.log('[Chat] No history found, showing welcome message');
          setMessages([{ id: 1, text: "Hi! I'm IkotAsk, your WashAlert assistant. How can I help you today?", sender: 'bot', time: 'Just now' }]);
        }
      }
    } catch (error) {
      if (!isSilent) {
        console.error('[Chat] Failed to load history:', error);
        setMessages([{ id: 1, text: "Hi! I'm IkotAsk, your WashAlert assistant. How can I help you today?", sender: 'bot', time: 'Just now' }]);
      } else {
        console.warn('[Chat] Silent polling failed:', error.message);
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const sendMessage = async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;

    const userMsg = { id: `opt-u-${Date.now()}`, text: trimmed, sender: 'user', time: 'Just now' };

    if (trimmed.toLowerCase() === 'talk to staff' || trimmed.toLowerCase() === 'talk to human') {
      setPendingMessage(trimmed);
      setShowBranchPicker(true);
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);



    let reply = 'Support service is temporarily unavailable. Please try again or ask for staff assistance.';

    try {
      const tracking = TRACKING_RE.exec(trimmed)?.[0]?.toUpperCase();
      const payload = await support.chat(trimmed, tracking, null, user?.fullName);
      
      if (payload?.category === 'escalated_chat') {
        // AI bypassed. Message is sent to staff.
        setIsTyping(false);
        return; // Don't append a bot reply, wait for staff via polling
      }
      
      if (payload?.reply) {
        reply = payload.reply;
      }
    } catch {
      reply = 'Support service is temporarily unavailable. Please try again or ask for staff assistance.';
    } finally {
      setIsTyping(false);
    }

    const botMsg = { id: `opt-b-${Date.now()}`, text: reply, sender: 'bot', time: 'Just now' };
    setMessages((prev) => [...prev, botMsg]);


  };

  const proceedWithEscalation = async (branchName) => {
    setShowBranchPicker(false);
    const textToSend = pendingMessage || 'Talk to Staff';
    setPendingMessage('');

    const userMsg = { id: `opt-eu-${Date.now()}`, text: textToSend, sender: 'user', time: 'Just now' };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);



    let reply = 'Support service is temporarily unavailable. Please try again or ask for staff assistance.';

    try {
      const tracking = TRACKING_RE.exec(textToSend)?.[0]?.toUpperCase();
      const payload = await support.chat(textToSend, tracking, branchName, user?.fullName);
      
      if (payload?.category === 'escalated_chat') {
        setIsTyping(false);
        return;
      }
      if (payload?.reply) {
        reply = payload.reply;
      }
    } catch {
      reply = 'Support service is temporarily unavailable. Please try again or ask for staff assistance.';
    } finally {
      setIsTyping(false);
    }

    const botMsg = { id: `opt-eb-${Date.now()}`, text: reply, sender: 'bot', time: 'Just now' };
    setMessages((prev) => [...prev, botMsg]);


  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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

        {isLoading ? (
          <View style={[styles.chatArea, styles.loadingContainer]}>
            <Text style={styles.loadingText}>Loading chat history...</Text>
          </View>
        ) : (
          <FlatList
            ref={scrollRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
            inverted
            data={[...(isTyping ? [{ id: '__typing__', sender: 'typing' }] : []), ...messages].reverse()}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item: msg }) => {
              if (msg.sender === 'typing') {
                return (
                  <View style={[styles.msgRow, styles.msgRowBot]}>
                    <View style={[styles.avatarBox, { backgroundColor: colors.mintSoft }]}>
                      <Ionicons name="chatbubbles" size={12} color={colors.accent} />
                    </View>
                    <View style={[styles.msgBubble, styles.bubbleBot]}>
                      <Text style={styles.msgTextBot}>Typing...</Text>
                    </View>
                  </View>
                );
              }
              return (
                <View style={[styles.msgRow, msg.sender === 'user' ? styles.msgRowUser : styles.msgRowBot]}>
                  {(msg.sender === 'bot' || msg.sender === 'staff') && (
                    <View style={[styles.avatarBox, { backgroundColor: msg.sender === 'staff' ? colors.goldSoft : colors.mintSoft }]}>
                      <Ionicons name={msg.sender === 'staff' ? "headset" : "chatbubbles"} size={12} color={colors.accent} />
                    </View>
                  )}
                  <View style={[styles.msgBubble, msg.sender === 'user' ? styles.bubbleUser : styles.bubbleBot, msg.sender === 'staff' && { borderColor: colors.gold, borderWidth: 1 }]}>
                    <Text style={[styles.msgText, msg.sender === 'user' ? styles.msgTextUser : styles.msgTextBot]} selectable={true}>{msg.text}</Text>
                  </View>
                  {msg.sender === 'user' && (
                    user?.profileImageUrl ? (
                      <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} />
                    ) : (
                      <View style={[styles.avatarBox, { backgroundColor: colors.goldSoft }]}>
                        <Ionicons name="person" size={12} color={colors.primary} />
                      </View>
                    )
                  )}
                </View>
              );
            }}
          />
        )}

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

        <Modal
          visible={showBranchPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowBranchPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Branch</Text>
              <Text style={styles.modalSubtitle}>Please choose the branch you want to talk to.</Text>
              <ScrollView style={styles.modalList}>
                {BRANCH_CATALOG.map((b) => (
                  <TouchableOpacity key={b.id} style={styles.modalBranchItem} onPress={() => proceedWithEscalation(b.name)}>
                    <Text style={styles.modalBranchName}>{b.name}</Text>
                    <Text style={styles.modalBranchCity}>{b.city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBranchPicker(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardWrap: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, shadowColor: colors.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  headerAvatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  headerOnline: { fontSize: 10, fontWeight: 'bold', color: colors.success },

  chatArea: { flex: 1 },
  chatContent: { padding: 16, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },

  avatarBox: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 28, height: 28, borderRadius: 14 },
  msgBubble: { maxWidth: '78%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 8 },
  bubbleBot: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 8 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextUser: { color: colors.card },
  msgTextBot: { color: colors.text },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  loadingText: { fontSize: 14, color: colors.textSecondary },

  quickRepliesWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  qrBtn: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, marginRight: 8 },
  qrText: { color: colors.primary, fontSize: 12, fontWeight: '500' },

  inputBox: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  inputField: { flex: 1, backgroundColor: colors.background, borderRadius: 14, paddingHorizontal: 16, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 48, height: 48, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  modalList: { marginBottom: 16 },
  modalBranchItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalBranchName: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  modalBranchCity: { fontSize: 13, color: colors.textSecondary },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { fontSize: 16, fontWeight: '600', color: colors.text },
});

export default ChatScreen;
