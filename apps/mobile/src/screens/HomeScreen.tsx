import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from "react-native";
import type { Driver, Vehicle } from "@logistics/shared";
import { apiFetch } from "../api/client";

interface Props {
  driver: Driver;
  onLogout: () => void;
  onReportIssue: (vehicle: Vehicle) => void;
}

const statusColor: Record<string, string> = {
  available: "#16A34A",
  on_duty: "#D97757",
  offline: "#6B7280",
};
const statusLabel: Record<string, string> = {
  available: "Available",
  on_duty: "On Duty",
  offline: "Offline",
};
const vehicleStatusColor: Record<string, string> = {
  operational: "#16A34A",
  in_maintenance: "#CA8A04",
  non_operational: "#DC2626",
};
const vehicleStatusLabel: Record<string, string> = {
  operational: "Operational",
  in_maintenance: "In Maintenance",
  non_operational: "Non Operational",
};

export default function HomeScreen({ driver: initialDriver, onLogout, onReportIssue }: Props) {
  const [driver, setDriver] = useState(initialDriver);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    try {
      const [drivers, vehicles] = await Promise.all([
        apiFetch<Driver[]>("/drivers"),
        apiFetch<Vehicle[]>("/vehicles?archived=false"),
      ]);
      const fresh = drivers.find((d) => d.id === initialDriver.id) ?? driver;
      setDriver(fresh);
      setVehicle(vehicles.find((v) => v.id === fresh.vehicleId) ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async () => {
    const next = driver.status === "on_duty" ? "available" : "on_duty";
    setToggling(true);
    try {
      await apiFetch(`/drivers/${driver.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      setDriver((d) => ({ ...d, status: next }));
    } catch {
      Alert.alert("Error", "Could not update status.");
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#D97757" />;

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>LogiTrack</Text>
            <Text style={styles.greeting}>Hello, {driver.name.split(" ")[0]}</Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Your Status</Text>
            <View style={[styles.badge, { backgroundColor: statusColor[driver.status] + "22" }]}>
              <View style={[styles.dot, { backgroundColor: statusColor[driver.status] }]} />
              <Text style={[styles.badgeText, { color: statusColor[driver.status] }]}>
                {statusLabel[driver.status]}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.toggleBtn, { backgroundColor: driver.status === "on_duty" ? "#E7E5E4" : "#D97757" }]}
            onPress={toggleStatus}
            disabled={toggling}
          >
            <Text style={[styles.toggleText, { color: driver.status === "on_duty" ? "#1C1917" : "#fff" }]}>
              {toggling ? "Updating..." : driver.status === "on_duty" ? "End Shift" : "Start Shift"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Assigned Vehicle</Text>
        {vehicle ? (
          <View style={styles.card}>
            <View style={styles.plateRow}>
              <Text style={styles.plate}>{vehicle.licensePlate}</Text>
              <View style={[styles.badge, { backgroundColor: vehicleStatusColor[vehicle.status] + "22" }]}>
                <View style={[styles.dot, { backgroundColor: vehicleStatusColor[vehicle.status] }]} />
                <Text style={[styles.badgeText, { color: vehicleStatusColor[vehicle.status] }]}>
                  {vehicleStatusLabel[vehicle.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.vehicleModel}>
              {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Unknown model"}
            </Text>
            {vehicle.hub ? <Text style={styles.vehicleMeta}>Hub: {vehicle.hub}</Text> : null}
            {vehicle.fuelType ? <Text style={styles.vehicleMeta}>Fuel: {vehicle.fuelType.charAt(0).toUpperCase() + vehicle.fuelType.slice(1)}</Text> : null}

            <TouchableOpacity style={styles.reportBtn} onPress={() => onReportIssue(vehicle)}>
              <Text style={styles.reportText}>Report Issue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { alignItems: "center", paddingVertical: 32 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🚗</Text>
            <Text style={{ color: "#78716C", fontSize: 14 }}>No vehicle assigned</Text>
            <Text style={{ color: "#A8A29E", fontSize: 12, marginTop: 4 }}>Contact your dispatcher</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  logo: { color: "#D97757", fontWeight: "800", fontSize: 16, letterSpacing: -0.3, marginBottom: 2 },
  greeting: { fontSize: 24, fontWeight: "800", color: "#1C1917" },
  logoutBtn: { paddingTop: 4 },
  logoutText: { color: "#A8A29E", fontSize: 13 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardLabel: { fontSize: 13, fontWeight: "600", color: "#78716C" },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  toggleBtn: { borderRadius: 10, padding: 13, alignItems: "center" },
  toggleText: { fontWeight: "700", fontSize: 15 },
  section: { fontSize: 13, fontWeight: "700", color: "#78716C", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  plateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  plate: { fontSize: 22, fontWeight: "800", color: "#1C1917", letterSpacing: 1 },
  vehicleModel: { fontSize: 15, color: "#44403C", marginBottom: 4 },
  vehicleMeta: { fontSize: 13, color: "#78716C", marginTop: 2 },
  reportBtn: { backgroundColor: "#DC2626", borderRadius: 10, padding: 13, alignItems: "center", marginTop: 16 },
  reportText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
