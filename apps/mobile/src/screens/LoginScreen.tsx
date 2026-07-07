import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput,
} from "react-native";
import type { Driver } from "@logistics/shared";
import { apiFetch } from "../api/client";

interface Props {
  onLogin: (driver: Driver) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Driver[]>("/drivers")
      .then((d) => setDrivers(d.filter((dr) => dr.status !== "offline")))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = drivers.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#D97757" />;

  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.logo}>LogiTrack</Text>
        <Text style={styles.heading}>Who are you?</Text>
        <Text style={styles.sub}>Select your name to start your shift</Text>

        <TextInput
          style={styles.search}
          placeholder="Search your name..."
          placeholderTextColor="#A8A29E"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />

        <FlatList
          data={filtered}
          keyExtractor={(d) => String(d.id)}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onLogin(item)} activeOpacity={0.7}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No drivers found.</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 20 },
  logo: { color: "#D97757", fontWeight: "800", fontSize: 22, letterSpacing: -0.5, marginBottom: 24 },
  heading: { fontSize: 26, fontWeight: "800", color: "#1C1917", marginBottom: 4 },
  sub: { fontSize: 14, color: "#78716C", marginBottom: 20 },
  search: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12,
    fontSize: 15, color: "#1C1917", marginBottom: 16,
    borderWidth: 1, borderColor: "#E7E5E4",
  },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    marginBottom: 10, flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#D97757", alignItems: "center", justifyContent: "center",
    marginRight: 14,
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  name: { fontSize: 16, fontWeight: "700", color: "#1C1917" },
  phone: { fontSize: 13, color: "#78716C", marginTop: 2 },
  arrow: { fontSize: 22, color: "#A8A29E" },
  empty: { textAlign: "center", color: "#A8A29E", marginTop: 40, fontSize: 14 },
});
