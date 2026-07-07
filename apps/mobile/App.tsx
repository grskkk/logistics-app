import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import type { Driver, Vehicle } from "@logistics/shared";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ReportIssueScreen from "./src/screens/DeliveryScreen";

type Screen = "login" | "home" | "report";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [driver, setDriver] = useState<Driver | null>(null);
  const [reportVehicle, setReportVehicle] = useState<Vehicle | null>(null);

  const handleLogin = (d: Driver) => {
    setDriver(d);
    setScreen("home");
  };

  const handleLogout = () => {
    setDriver(null);
    setScreen("login");
  };

  const handleReportIssue = (v: Vehicle) => {
    setReportVehicle(v);
    setScreen("report");
  };

  return (
    <>
      <StatusBar style="dark" />
      {screen === "login" && (
        <LoginScreen onLogin={handleLogin} />
      )}
      {screen === "home" && driver && (
        <HomeScreen
          driver={driver}
          onLogout={handleLogout}
          onReportIssue={handleReportIssue}
        />
      )}
      {screen === "report" && reportVehicle && (
        <ReportIssueScreen
          vehicle={reportVehicle}
          onBack={() => setScreen("home")}
        />
      )}
    </>
  );
}
