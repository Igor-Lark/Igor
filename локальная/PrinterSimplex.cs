using System;
using System.Runtime.InteropServices;

public static class PrintBridgeDuplex
{
    const int DM_DUPLEX = 0x1000;
    const short DMDUP_SIMPLEX = 1;
    const int DM_OUT_BUFFER = 2;

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    static extern int DocumentProperties(
        IntPtr hwnd, IntPtr hPrinter, string pDeviceName,
        IntPtr pDevModeOutput, IntPtr pDevModeInput, int fMode);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    static extern bool GetPrinter(IntPtr hPrinter, int level, IntPtr pPrinter, int cbBuf, out int pcbNeeded);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    static extern bool SetPrinter(IntPtr hPrinter, int level, IntPtr pPrinter, int command);

    public static bool ForceSimplex(string printerName)
    {
        if (string.IsNullOrEmpty(printerName)) return false;
        IntPtr h;
        if (!OpenPrinter(printerName, out h, IntPtr.Zero)) return false;
        try
        {
            int needed;
            GetPrinter(h, 2, IntPtr.Zero, 0, out needed);
            if (needed <= 0) return false;
            IntPtr buf = Marshal.AllocHGlobal(needed);
            try
            {
                if (!GetPrinter(h, 2, buf, needed, out needed)) return false;
                int pDevModeOffset = IntPtr.Size * 7;
                IntPtr pDevMode = Marshal.ReadIntPtr(buf, pDevModeOffset);
                if (pDevMode == IntPtr.Zero)
                {
                    int sz = DocumentProperties(IntPtr.Zero, h, printerName, IntPtr.Zero, IntPtr.Zero, 0);
                    if (sz <= 0) return false;
                    pDevMode = Marshal.AllocHGlobal(sz);
                    if (DocumentProperties(IntPtr.Zero, h, printerName, pDevMode, IntPtr.Zero, DM_OUT_BUFFER) < 0)
                        return false;
                    Marshal.WriteIntPtr(buf, pDevModeOffset, pDevMode);
                }
                int dmFields = Marshal.ReadInt32(pDevMode, 72);
                Marshal.WriteInt32(pDevMode, 72, dmFields | DM_DUPLEX);
                Marshal.WriteInt16(pDevMode, 94, DMDUP_SIMPLEX);
                return SetPrinter(h, 2, buf, 0);
            }
            finally
            {
                Marshal.FreeHGlobal(buf);
            }
        }
        finally
        {
            ClosePrinter(h);
        }
    }
}
