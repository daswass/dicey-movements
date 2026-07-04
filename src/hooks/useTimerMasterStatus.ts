import { useEffect, useState } from "react";
import { timerSyncService } from "../utils/timerSyncService";

export function useTimerMasterStatus() {
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    const checkMasterStatus = async () => {
      try {
        const masterStatus = await timerSyncService.isDeviceMaster();
        setIsMaster(masterStatus);
      } catch (error) {
        console.error("useTimerMasterStatus: Error checking master status:", error);
      }
    };

    checkMasterStatus();

    const unsubscribe = timerSyncService.onMasterStatusChange(setIsMaster);
    const interval = setInterval(checkMasterStatus, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return isMaster;
}
