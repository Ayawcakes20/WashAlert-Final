import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const EditProfileScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    email: user?.email || "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.fullName || form.fullName.length < 2) e.fullName = "Name required (min 2 chars)";
    if (!form.phone || !/^09\d{9}$/.test(form.phone)) e.phone = "Valid PH number (09XXXXXXXXX)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Text style={[styles.saveText, loading && { opacity: 0.5 }]}>
              {loading ? "Saving..." : saved ? "Saved ✓" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Avatar Area */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatarBox}>
            <Ionicons name="person-circle-outline" size={64} color={colors.primary} />
          </View>
          <TouchableOpacity style={styles.cameraBtn}>
            <Ionicons name="camera" size={16} color={colors.card} />
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          <View style={styles.fieldBox}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              value={form.fullName}
              onChangeText={(t) => setField('fullName', t)}
              placeholder="Your full name"
            />
            {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={form.phone}
              onChangeText={(t) => setField('phone', t)}
              keyboardType="phone-pad"
              placeholder="09XXXXXXXXX"
            />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={form.email}
              editable={false}
            />
            <Text style={styles.hintText}>Email cannot be changed</Text>
          </View>

          <TouchableOpacity style={styles.pwdBtn}>
            <Text style={styles.pwdBtnText}>Change Password</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 14, fontWeight: '500', color: colors.text, marginLeft: 8 },
  saveText: { fontSize: 14, fontWeight: 'bold', color: colors.primary },

  avatarWrap: { alignItems: 'center', marginBottom: 32 },
  avatarBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'hsla(224, 82%, 48%, 0.1)', alignItems: 'center', justifyContent: 'center' },
  cameraBtn: { position: 'absolute', bottom: 0, right: '35%', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },

  formContainer: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  fieldBox: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 6 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, height: 52, fontSize: 14, color: colors.text },
  inputError: { borderColor: colors.error },
  inputDisabled: { backgroundColor: colors.border, color: colors.textSecondary },
  errorText: { color: colors.error, fontSize: 12, marginTop: 4 },
  hintText: { color: colors.textSecondary, fontSize: 10, marginTop: 4 },

  pwdBtn: { width: '100%', height: 44, borderWidth: 1, borderColor: colors.warning, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  pwdBtnText: { color: colors.warning, fontSize: 14, fontWeight: '600' },
});

export default EditProfileScreen;
