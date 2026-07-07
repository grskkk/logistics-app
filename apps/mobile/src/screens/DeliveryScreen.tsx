import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, TextInput, Alert,
} from "react-native";
import type { Vehicle } from "@logistics/shared";
import { apiFetch } from "../api/client";

interface Props {
  vehicle: Vehicle;
  onBack: () => void;
}

const SERVICE_TYPES = [
  "Tire Change",
  "Oil Service",
  "Brakes",
  "Accident Damage",
  "Electrical Issue",
  "AC Service",
  "Other",
];

export default function ReportIssueScreen({ vehicle, onBack }: Props) {
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiFetch(`/maintenance/${vehicle.id}`, {
        method: "POST",
        body: JSON.stringify({
          serviceType,
          notes: notes.trim() || null,
          workshop: workshop.trim() || null,
        }),
      });
      Alert.alert("Reported", "Issue logged successfully.", [{ text: "OK", onPress: onBack }]);
    } catch {
      Alert.alert("Error", "Could not submit report. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.heading}>Report Issue</Text>
        <Text style={styles.plate}>{vehicle.licensePlate}</Text>
        <Text style={styles.model}>{[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</Text>

        <Text style={styles.label}>Issue Type</Text>
        <View style={styles.pills}>
          {SERVICE_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setServiceType(t)}
              style={[styles.pill, serviceType === t && styles.pillActive]}
            >
              <Text style={[styles.pillText, serviceType === t && styles.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Workshop (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Athens Service Center"
          placeholderTextColor="#A8A29E"
          value={workshop}
          onChangeText={setWorkshop}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the issue..."
          placeholderTextColor="#A8A29E"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Report"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9F7F4" },
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  back: { color: "#D97757", fontSize: 17, fontWeight: "600" },
  heading: { fontSize: 26, fontWeight: "800", color: "#1C1917", marginBottom: 4 },
  plate: { fontSize: 20, fontWeight: "800", color: "#44403C", letterSpacing: 1, marginBottom: 2 },
  model: { fontSize: 14, color: "#78716C", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "700", color: "#78716C", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E7E5E4",
  },
  pillActive: { backgroundColor: "#1C1917", borderColor: "#1C1917" },
  pillText: { fontSize: 13, fontWeight: "600", color: "#78716C" },
  pillTextActive: { color: "#fff" },
  input: {
    backgroundColor: "#fff", borderRadius: 10, padding: 13,
    fontSize: 15, color: "#1C1917", marginBottom: 16,
    borderWidth: 1, borderColor: "#E7E5E4",
  },
  textArea: { minHeight: 100, paddingTop: 12 },
  submitBtn: { backgroundColor: "#D97757", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  submitBtnDisabled: { backgroundColor: "#D6D3D1" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
