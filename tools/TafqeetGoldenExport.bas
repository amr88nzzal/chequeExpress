Attribute VB_Name = "TafqeetGoldenExport"
Option Explicit

' Exports test cases for the new amount-in-words package.
' Run ExportTafqeetCases once. It writes tafqeet_cases.csv next to the workbook
' (or on the Desktop if the workbook was never saved) with two columns:
'   amount, words
' It calls ArbNum2Text exactly like the cheque sheet does:
'   ArbNum2Text(value, 3, 3, "dinar ", "dinars ", 0, "fils", "fils", 1)
' The Arabic words are built with ChrW so this file imports cleanly on any code page.
'
' FIX 2026-10-12: line 78 previously read
'   value = CDbl(parts(0)) + CLng(parts(1)) / 1000
' CLng overflows for any integer part above Long's max (2,147,483,647), and the
' edge-case list below contains 999999999999. That raised an uncaught run-time
' error 6 BEFORE SaveToFile ran, so the CSV was never produced at all.
' The CLng was also pointless: dividing a Double by an integer yields a Double.
' Dropping it keeps every value identical and lets the export complete.

Private Function Cases() As Collection
  Dim c As New Collection
  Dim i As Long, k As Long, ip As Double, fp As Long, digits As Long, j As Long

  ' 1) every integer 0..2000
  For i = 0 To 2000
    c.Add CStr(i) & ".000"
  Next i

  ' 2) hand-picked edge cases around thousands and millions
  Dim edge As Variant
  edge = Array(2001, 2002, 2100, 10000, 11000, 12000, 20000, 21000, 22000, 100000, 101000, 102000, _
               110000, 111000, 200000, 200001, 201000, 202000, 210000, 222222, 999999, 1000000, 1000001, _
               1000002, 1001000, 1002000, 1100000, 2000000, 2000001, 2002000, 2200000, 3000000, 10000000, _
               11000000, 100000000, 123456789, 1000000000, 2000000000, 999999999999#)
  For i = LBound(edge) To UBound(edge)
    c.Add Format$(edge(i), "0") & ".000"
  Next i

  ' 3) every fils value 0..999 on top of a fixed integer part, plus 0.xxx
  For fp = 0 To 999
    c.Add "0." & Right$("000" & CStr(fp), 3)
    c.Add "125." & Right$("000" & CStr(fp), 3)
  Next fp

  ' 4) 4000 pseudo-random amounts (fixed seed, 1..12 integer digits)
  Rnd -1
  Randomize 20261005
  For k = 1 To 4000
    digits = 1 + Int(Rnd * 12)
    ip = 0
    For j = 1 To digits
      ip = ip * 10 + Int(Rnd * 10)
    Next j
    fp = Int(Rnd * 1000)
    c.Add Format$(ip, "0") & "." & Right$("000" & CStr(fp), 3)
  Next k

  Set Cases = c
End Function

Public Sub ExportTafqeetCases()
  Dim cur1 As String, cur2 As String, fr As String
  cur1 = ChrW(1583) & ChrW(1610) & ChrW(1606) & ChrW(1575) & ChrW(1585) & " "
  cur2 = ChrW(1583) & ChrW(1606) & ChrW(1575) & ChrW(1606) & ChrW(1610) & ChrW(1585) & " "
  fr = ChrW(1601) & ChrW(1604) & ChrW(1587)

  Dim path As String
  path = ThisWorkbook.Path
  If path = "" Then path = Environ$("USERPROFILE") & "\Desktop"
  path = path & "\tafqeet_cases.csv"

  Dim stm As Object
  Set stm = CreateObject("ADODB.Stream")
  stm.Type = 2
  stm.Charset = "utf-8"
  stm.Open
  stm.WriteText "amount,words" & vbCrLf

  Dim c As Collection, v As Variant, parts() As String
  Dim words As String, value As Double, n As Long, errs As Long
  Set c = Cases()

  For Each v In c
    parts = Split(CStr(v), ".")
    ' value is built the way Excel would hold it: integer part + fils / 1000 (a Double)
    ' NOTE: no CLng here - it overflows above 2,147,483,647 and the edge list goes to ~1e12.
    value = CDbl(parts(0)) + CDbl(parts(1)) / 1000
    On Error Resume Next
    words = ""
    words = ArbNum2Text(value, 3, 3, cur1, cur2, 0, fr, fr, 1)
    If Err.Number <> 0 Then words = "ERR " & Err.Number: errs = errs + 1: Err.Clear
    On Error GoTo 0
    stm.WriteText CStr(v) & "," & Chr(34) & Replace(words, Chr(34), Chr(34) & Chr(34)) & Chr(34) & vbCrLf
    n = n + 1
  Next v

  stm.SaveToFile path, 2
  stm.Close
  MsgBox "Exported " & n & " cases (" & errs & " errors) to:" & vbCrLf & path
End Sub
