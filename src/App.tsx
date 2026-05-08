import { useState, useEffect, useMemo } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { saveAs } from 'file-saver';
import { useGoogleLogin } from '@react-oauth/google';
import LoadingSpinner from './components/LoadingSpinner';
import { 
  BookOpen, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Cloud, 
  Plus, 
  Trash2, 
  Eye, 
  Sparkles,
  School,
  GraduationCap,
  Clock,
  User,
  ShieldCheck,
  MessageSquare,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export default function App() {
  const [unit, setUnit] = useState('Sekolah');
  const [schoolName, setSchoolName] = useState('');
  const [subject, setSubject] = useState('Pendidikan Agama Islam');
  const [material, setMaterial] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [grade, setGrade] = useState('');
  const [timeAllocation, setTimeAllocation] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherNIP, setTeacherNIP] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [principalNIP, setPrincipalNIP] = useState('');
  const [logo, setLogo] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('school_logo');
    }
    return null;
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [lkpdSuggestion, setLkpdSuggestion] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [driveSuccess, setDriveSuccess] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'word' | 'pdf' | 'drive', title: string, message: string } | null>(null);

  const saveToDrive = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsUploadingDrive(true);
      setDriveSuccess(false);
      try {
        const element = document.getElementById('rpp-result');
        if (!element) throw new Error('Preview tidak ditemukan');

        const opt = {
          margin:       [15, 15, 20, 15] as [number, number, number, number],
          filename:     `RPP_${subject}_${grade}.pdf`,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, logging: false },
          jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };

        const pdfBlob = await html2pdf().set(opt).from(element).output('blob');

        const metadata = {
          name: `RPP_${subject}_${grade}.pdf`,
          mimeType: 'application/pdf',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', pdfBlob);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
          body: form,
        });

        if (!res.ok) throw new Error('Gagal mengunggah ke Google Drive');

        setDriveSuccess(true);
        setTimeout(() => setDriveSuccess(false), 5000);
      } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan saat menyimpan ke Google Drive. Pastikan Anda membuka Pratinjau terlebih dahulu.');
      } finally {
        setIsUploadingDrive(false);
      }
    },
    scope: 'https://www.googleapis.com/auth/drive.file',
    onError: (error) => {
      console.error('Google Login Failed', error);
      alert('Gagal login ke Google.');
    }
  });

  const handleSaveToDriveClick = () => {
    if (!(import.meta as any).env.VITE_GOOGLE_CLIENT_ID) {
      alert('Google Client ID belum dikonfigurasi. Silakan tambahkan VITE_GOOGLE_CLIENT_ID di pengaturan environment.');
      return;
    }
    saveToDrive();
  };

  const requestConfirm = (type: 'word' | 'pdf' | 'drive') => {
    const titles = {
      word: 'Simpan Word',
      pdf: 'Simpan PDF',
      drive: 'Simpan ke Drive'
    };
    const messages = {
      word: 'Apakah Anda yakin ingin mengunduh dokumen ini dalam format Word?',
      pdf: 'Apakah Anda yakin ingin mengunduh dokumen ini dalam format PDF?',
      drive: 'Apakah Anda yakin ingin menyimpan dokumen ini ke Google Drive Anda?'
    };
    setConfirmAction({ type, title: titles[type], message: messages[type] });
  };

  const ConfirmModal = () => {
    if (!confirmAction) return null;

    const handleConfirm = () => {
      if (confirmAction.type === 'word') {
        handleDownloadWord();
      } else if (confirmAction.type === 'pdf') {
        handleDownloadPdf();
      } else if (confirmAction.type === 'drive') {
        handleSaveToDriveClick();
      }
      setConfirmAction(null);
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-2">{confirmAction.title}</h3>
          <p className="text-slate-300 mb-6">{confirmAction.message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmAction(null)}
              className="px-4 py-2 rounded-lg font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Ya, Lanjutkan
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!material || material.trim().length < 3) {
      setLkpdSuggestion('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Berikan 1 saran aktivitas LKPD (Lembar Kerja Peserta Didik) yang kreatif, menantang (HOTS), dan aplikatif untuk materi pelajaran: "${material}". Jawab dengan singkat, maksimal 2 kalimat.`,
        });
        setLkpdSuggestion(response.text || '');
      } catch (err) {
        console.error("Failed to generate suggestion", err);
        setLkpdSuggestion('');
      } finally {
        setIsSuggesting(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [material]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!schoolName.trim()) errors.schoolName = 'Nama Sekolah harus diisi.';
    if (!subject.trim()) errors.subject = 'Mata Pelajaran harus diisi.';
    if (!material.trim()) errors.material = 'Materi harus diisi.';
    if (!learningObjectives.trim()) errors.learningObjectives = 'Tujuan Pembelajaran harus diisi.';
    if (!grade.trim()) errors.grade = 'Kelas/Semester harus diisi.';
    if (!timeAllocation.trim()) errors.timeAllocation = 'Alokasi Waktu harus diisi.';
    if (!teacherName.trim()) errors.teacherName = 'Nama Guru harus diisi.';
    if (!principalName.trim()) errors.principalName = 'Nama Kepala Sekolah harus diisi.';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setResult('');

    try {
      const prompt = `Buatkan saya rencana pembelajaran (RPP) yang "Pintar" dan "Interaktif" (RAPI) dengan detail sebagai berikut:
      - Satuan Pendidikan: ${unit}
      - Nama Sekolah: ${schoolName}
      - Mata Pelajaran: ${subject}
      - Materi: ${material}
      - Tujuan Pembelajaran: ${learningObjectives}
      - Kelas/Semester: ${grade}
      - Alokasi Waktu: ${timeAllocation}

      PENTING: Fokuskan isi RPP agar selaras dengan Tujuan Pembelajaran yang telah ditentukan di atas.

      MODUL AJAR / RPP INI HARUS BERNUANSA RELIGIUS, MODERN, DAN INTERAKTIF.

      Struktur Rencana Pembelajaran harus diawali dengan Identitas Modul, lalu dibagi menjadi bagian-bagian berikut:

      **Identitas Modul**
      - Nama Lembaga: ${schoolName}
      - Mata Pelajaran: ${subject}
      - Materi: ${material}
      - Tujuan Pembelajaran: ${learningObjectives}
      - Kelas/Semester: ${grade}
      - Alokasi Waktu: ${timeAllocation}

      I. Identifikasi & Karakteristik Murid (Format tabel Markdown):
      | No | Aspek | Uraian Rinci |
      |:---:|:---|:---|
      | 1 | Profil Pelajar Pancasila | Hubungkan materi dengan dimensi Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia secara spesifik. |
      | 2 | Target Peserta Didik | Jelaskan karakteristik murid dan kesiapan belajar mereka. |

      II. Desain Pembelajaran Pintar (Format tabel Markdown):
      | No | Komponen | Strategi Interaktif & Implementasi Digital |
      |:---:|:---|:---|
      | 1 | Tujuan Pembelajaran | Jabarkan tujuan yang mencakup aspek kognitif, afektif (spiritual), dan psikomotorik. |
      | 2 | Model Pembelajaran | Gunakan model interaktif seperti Project/Problem Based Learning, Discovery Learning, atau Inquiry. |
      | 3 | Integrasi Teknologi | Jelaskan penggunaan platform digital (kuis interaktif, murottal digital, peta konsep digital, dll). |

      III. Media Pembelajaran (Wajib tabel Markdown):
      | Media | Sumber/Tautan Referensi | Fungsi dalam Pembelajaran |
      |:---|:---|:---|
      | Video YouTube | Berikan link YouTube spesifik yang sangat relevan dengan materi ${material} | Memvisualisasikan konsep secara nyata |
      | Game Interaktif | Berikan link game interaktif (seperti Wordwall, Quizizz, atau lainnya) yang relevan dengan ${material} | Penguatan materi melalui bermain |
      | Media Ajar | Berikan link media ajar digital (Canva/PPT Online/Lainnya) yang sesuai tema | Membantu penyampaian materi secara visual |
      | Digital Library | Referensi ebook atau artikel | Pengayaan literasi digital murid |

      IV. Skenario Pembelajaran Interaktif (Gunakan estimasi waktu):
      ### A. Pendahuluan (Membuka Hati & Pikiran)
      - Kegiatan religius pembuka (doa, tadarus singkat).
      - Apersepsi menggunakan pertanyaan pemantik yang menantang.
      ### B. Kegiatan Inti (Eksplorasi & Kolaborasi)
      1. **Mengamati & Menanya**: Murid mengobservasi media digital.
      2. **Mengeksplorasi**: Aktivitas berkelompok/mandiri menggunakan alat bantu interaktif.
      3. **Asosiasi & Komunikasi**: Murid mempresentasikan hasil pemikiran secara kreatif.
      ### C. Penutup (Refleksi & Doa)
      - Kesimpulan bersama murid dan pesan moral/spiritual (Hikmah).
      - Rencana pembelajaran berikutnya.

      V. Penilaian Berkelanjutan (Wajib tabel Markdown):
      | Teknik | Instrumen | Kriteria Ketercapaian (KKTP) |
      |:---|:---|:---|
      | Sikap (Spiritual/Sosial) | Jurnal/Observasi | Menunjukkan akhlak mahmudah selama proses belajar. |
      | Pengetahuan | Tes Tertulis/Digital | Memahami konsep inti materi sebesar >75%. |
      | Keterampilan | Unjuk Kerja/Produk | Mampu mengaplikasikan nilai agama dalam simulasi/tugas. |

      VI. LKPD Interaktif:
      - Buatkan draf Lembar Kerja yang berisi tugas menantang (HOTS) dan instruksi yang ceria.
      - Tambahkan bagian "Refleksi Diriku" sebagai penilaian diri sendiri.

      VII. Ringkasan Materi & Pengayaan:
      - Rangkuman poin-poin penting yang mudah diingat.
      - Tugas tambahan yang kreatif bagi murid yang sudah tuntas.

      VIII. Pengesahan:
      | Mengetahui, | |  |
      | :--- | :--- | :--- |
      | Kepala Sekolah, | | Guru Mata Pelajaran, |
      | | | |
      | | | |
      | **${principalName}** | | **${teacherName}** |
      | NIP. ${principalNIP || '-'} | | NIP. ${teacherNIP || '-'} |

      **CATATAN PENTING**: Format seluruh output dalam Markdown yang sangat rapi. Gunakan bahasa Indonesia yang baik, benar, dan memotivasi.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      // Clean up any potential <br> tags from the response
      const cleanedText = response.text.replace(/<br\s*\/?>/gi, ' ');
      setResult(cleanedText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan tidak diketahui');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('rpp-content');
    if (!element) return;

    // Create a temporary container for PDF to ensure light theme and proper styling
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '800px'; 
    tempDiv.style.backgroundColor = '#ffffff';
    tempDiv.style.color = '#000000';
    
    // Add a class for targeting and a style block to override oklch colors
    tempDiv.className = 'pdf-export-container prose prose-slate max-w-none p-10 bg-white text-black font-sans';
    
    // Add logo to PDF if exists
    if (logo) {
      const logoImg = document.createElement('img');
      logoImg.src = logo;
      logoImg.style.display = 'block';
      logoImg.style.margin = '0 auto 20px';
      logoImg.style.height = '80px';
      logoImg.style.objectFit = 'contain';
      tempDiv.insertBefore(logoImg, tempDiv.firstChild);
    }

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = element.innerHTML;
    tempDiv.appendChild(contentDiv);
    document.body.appendChild(tempDiv);

    const opt = {
      margin: 0.5,
      filename: `RPP_${subject}_${schoolName || 'Pembelajaran'}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(tempDiv).save().then(() => {
      document.body.removeChild(tempDiv);
    });
  };

  const handleDownloadWord = () => {
    const element = document.getElementById('rpp-content');
    if (!element) return;

    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>RPP Export</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }
          th { background-color: #f2f2f2; }
          h1, h2, h3 { color: #333; }
          .title { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 20px; }
          .logo { text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        ${logo ? `<div class='logo'><img src='${logo}' height='80' /></div>` : ''}
    `;
    const footer = "</body></html>";
    const content = element.innerHTML;
    const sourceHTML = header + content + footer;

    const blob = new Blob([sourceHTML], { type: 'application/vnd.ms-word;charset=utf-8' });
    saveAs(blob, `RPP_${schoolName || 'Pembelajaran'}.doc`);
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogo(base64);
        localStorage.setItem('school_logo', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogo(null);
    localStorage.removeItem('school_logo');
  };

  const PreviewModal = () => {
    if (!showPreview) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl border border-slate-700">
          <div className="p-4 border-bottom border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-2xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              Pratinjau Dokumen
            </h2>
            <button 
              onClick={() => setShowPreview(false)}
              className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-700/30">
            <div className="mx-auto bg-white text-black shadow-xl min-h-[11in] w-full max-w-[8.5in] p-12 rounded-sm origin-top transition-transform duration-300">
              {logo && (
                <div className="flex justify-center mb-8">
                  <img src={logo} alt="Logo Sekolah" className="h-24 w-auto object-contain" referrerPolicy="no-referrer" />
                </div>
              )}
              <div className="prose prose-slate max-w-none prose-headings:text-black prose-p:text-black prose-table:border prose-table:border-black prose-th:bg-slate-100 prose-th:border prose-th:border-black prose-td:border prose-td:border-black">
                <Markdown remarkPlugins={[remarkGfm]}>{result}</Markdown>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 border-t border-slate-700 rounded-b-2xl flex flex-wrap justify-center gap-4">
            <button
              onClick={() => requestConfirm('word')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Simpan Word
            </button>
            <button
              onClick={() => requestConfirm('pdf')}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Simpan PDF
            </button>
            <button
              onClick={() => requestConfirm('drive')}
              disabled={isUploadingDrive}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-.398-1.539l-8.776-4.273a1 1 0 0 0-.863 0L2.361 5.273a1 1 0 0 0-.398 1.539l8.776 4.273a1 1 0 0 0 .863 0l8.776-4.273z"/><path d="m21.174 12.812-8.776 4.273a1 1 0 0 1-.863 0L2.361 12.812"/><path d="m21.174 18.812-8.776 4.273a1 1 0 0 1-.863 0L2.361 18.812"/></svg>
              {isUploadingDrive ? 'Menyimpan...' : driveSuccess ? 'Tersimpan!' : 'Simpan ke Drive'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleInputChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    field: string
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const isFormValid = schoolName.trim() && subject.trim() && material.trim() && grade.trim() && timeAllocation.trim() && teacherName.trim() && principalName.trim();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500/30 selection:text-orange-200 italic-selection overflow-x-hidden">
      {/* Enhanced Background Decorations */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {/* Animated Glows/Blobs */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
            x: [0, 50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-orange-600 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.1, 0.05],
            x: [0, -40, 0],
            y: [0, 60, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-15%] left-[-10%] w-[700px] h-[700px] bg-blue-600 rounded-full blur-[150px]" 
        />

        {/* Floating Decorative Elements */}
        {useMemo(() => [
          { icon: BookOpen, top: '15%', left: '10%', delay: 0 },
          { icon: Sparkles, top: '45%', right: '8%', delay: 5 },
          { icon: GraduationCap, bottom: '20%', left: '5%', delay: 10 },
          { icon: Cloud, top: '10%', right: '15%', delay: 3 },
          { icon: MessageSquare, bottom: '10%', right: '12%', delay: 7 }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.03, 0.08, 0.03],
              y: [0, -30, 0],
              rotate: [0, 10, -10, 0]
            }}
            transition={{ duration: 10 + i, repeat: Infinity, ease: "easeInOut", delay: item.delay }}
            className="absolute text-orange-500 hidden lg:block"
            style={{ top: item.top, left: item.left, right: item.right, bottom: item.bottom }}
          >
            <item.icon size={48} strokeWidth={1} />
          </motion.div>
        )), [])}
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-12">
        <header className="text-center space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            {logo ? (
              <div className="mb-6 relative group">
                <div className="p-4 bg-slate-900 rounded-3xl shadow-xl shadow-orange-950/20 border border-slate-800 backdrop-blur-sm transform transition-transform group-hover:scale-105 duration-500">
                  <img src={logo} alt="Logo Sekolah" className="h-20 w-auto object-contain" referrerPolicy="no-referrer" />
                </div>
                <button 
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                  title="Hapus Logo"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <div className="mb-8">
                <label className="cursor-pointer group flex flex-col items-center justify-center w-36 h-36 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/50 hover:border-orange-500 hover:bg-orange-500/5 transition-all duration-500 shadow-sm">
                  <div className="flex flex-col items-center gap-3 text-slate-600 group-hover:text-orange-500">
                    <div className="p-4 rounded-2xl bg-slate-800 group-hover:bg-orange-500/10 transition-colors">
                      <Plus size={32} strokeWidth={1.5} />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-sans">Unggah Logo</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              </div>
            )}

            <div className="space-y-1">
              <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
                RAPI
              </h1>
              <p className="text-orange-500 font-bold tracking-[0.3em] text-xs uppercase pt-2">
                RPP Agama Pintar Interaktif
              </p>
            </div>
            
            <div className="mt-6 space-y-2">
              <p className="text-slate-400 font-serif italic text-lg opacity-80">
                "RPP Cepat, Pembelajaran Bermakna"
              </p>
              <div className="h-px w-12 bg-orange-900/50 mx-auto" />
            </div>
          </motion.div>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 rounded-[2rem] p-8 md:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-slate-800"
        >
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              <div className="space-y-3">
                <label htmlFor="unit" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <School size={14} /> Satuan Pendidikan
                </label>
                <div className="relative">
                  <select
                    id="unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-slate-800 hover:border-orange-500/50 transition-colors py-3 text-slate-200 font-medium focus:outline-none focus:border-orange-500 appearance-none"
                  >
                    <option className="bg-slate-900 text-slate-200">Sekolah</option>
                    <option className="bg-slate-900 text-slate-200">Madrasah</option>
                  </select>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <motion.div animate={{ y: [0, 2, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </motion.div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label htmlFor="schoolName" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <Plus size={14} /> Nama Sekolah
                </label>
                <input
                  type="text"
                  id="schoolName"
                  value={schoolName}
                  onChange={handleInputChange(setSchoolName, 'schoolName')}
                  placeholder="Contoh: SDN Luwuk"
                  className={`w-full bg-transparent border-b-2 py-3 text-slate-200 font-medium placeholder-slate-700 focus:outline-none transition-colors ${validationErrors.schoolName ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-orange-500'}`}
                />
                {validationErrors.schoolName && <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">{validationErrors.schoolName}</p>}
              </div>

              <div className="md:col-span-2 space-y-3">
                <label htmlFor="subject" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <BookOpen size={14} /> Mata Pelajaran
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={handleInputChange(setSubject, 'subject')}
                  placeholder="Contoh: Pendidikan Agama Islam"
                  className={`w-full bg-transparent border-b-2 py-3 text-slate-200 font-medium placeholder-slate-700 focus:outline-none transition-colors ${validationErrors.subject ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-orange-500'}`}
                />
                {validationErrors.subject && <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">{validationErrors.subject}</p>}
              </div>

              <div className="md:col-span-2 space-y-3">
                <label htmlFor="material" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <Sparkles size={14} /> Materi Pembelajaran
                </label>
                <textarea
                  id="material"
                  value={material}
                  onChange={handleInputChange(setMaterial, 'material')}
                  placeholder="Deskripsikan materi pokok yang akan diajarkan..."
                  rows={2}
                  className={`w-full bg-slate-800/30 rounded-2xl border-2 p-4 text-slate-200 font-medium placeholder-slate-700 focus:outline-none transition-all ${validationErrors.material ? 'border-red-500/20 focus:border-red-500' : 'border-slate-800 focus:border-orange-500/50 focus:bg-slate-800/50'}`}
                />
                {validationErrors.material && <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">{validationErrors.material}</p>}
                
                <AnimatePresence>
                  {(isSuggesting || lkpdSuggestion) && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 flex items-start gap-4"
                    >
                      <div className="p-2 bg-slate-800 rounded-lg shadow-sm text-orange-500">
                        <Sparkles size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-orange-400 mb-1">Inspirasi Interaktif:</p>
                        {isSuggesting ? (
                          <div className="flex gap-1 py-1">
                            {[0, 1, 2].map(i => (
                              <motion.div 
                                key={i}
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                                className="w-1 h-1 rounded-full bg-orange-500"
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-300 leading-relaxed font-serif italic">{lkpdSuggestion}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="md:col-span-2 space-y-3">
                <label htmlFor="learningObjectives" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Tujuan Pembelajaran
                </label>
                <textarea
                  id="learningObjectives"
                  value={learningObjectives}
                  onChange={handleInputChange(setLearningObjectives, 'learningObjectives')}
                  placeholder="Contoh: Murid dapat melafalkan surah Al-Fatihah dengan tartil..."
                  rows={2}
                  className={`w-full bg-slate-800/30 rounded-2xl border-2 p-4 text-slate-200 font-medium placeholder-slate-700 focus:outline-none transition-all ${validationErrors.learningObjectives ? 'border-red-500/20 focus:border-red-500' : 'border-slate-800 focus:border-orange-500/50 focus:bg-slate-800/50'}`}
                />
                {validationErrors.learningObjectives && <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">{validationErrors.learningObjectives}</p>}
              </div>

              <div className="space-y-3">
                <label htmlFor="grade" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <GraduationCap size={14} /> Kelas / Semester
                </label>
                <input
                  type="text"
                  id="grade"
                  value={grade}
                  onChange={handleInputChange(setGrade, 'grade')}
                  placeholder="Contoh: 1 / Genap"
                  className={`w-full bg-transparent border-b-2 py-3 text-slate-200 font-medium placeholder-slate-700 focus:outline-none transition-colors ${validationErrors.grade ? 'border-red-500/50 focus:border-red-500' : 'border-slate-800 focus:border-orange-500'}`}
                />
                {validationErrors.grade && <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">{validationErrors.grade}</p>}
              </div>

              <div className="space-y-3">
                <label htmlFor="timeAllocation" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <Clock size={14} /> Alokasi Waktu
                </label>
                <input
                  type="text"
                  id="timeAllocation"
                  value={timeAllocation}
                  onChange={handleInputChange(setTimeAllocation, 'timeAllocation')}
                  placeholder="Contoh: 2 x 35 Menit"
                  className={`w-full bg-transparent border-b-2 py-3 text-slate-200 font-medium placeholder-slate-700 focus:outline-none transition-colors ${validationErrors.timeAllocation ? 'border-red-300 focus:border-red-500' : 'border-slate-800 focus:border-orange-500'}`}
                />
                {validationErrors.timeAllocation && <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">{validationErrors.timeAllocation}</p>}
              </div>

              <div className="space-y-3">
                <label htmlFor="teacherName" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <User size={14} /> Nama Guru
                </label>
                <input
                  type="text"
                  id="teacherName"
                  value={teacherName}
                  onChange={handleInputChange(setTeacherName, 'teacherName')}
                  placeholder="Nama Lengkap & Gelar"
                  className={`w-full bg-transparent border-b-2 py-3 text-slate-200 font-medium placeholder-slate-700 focus:outline-none transition-colors ${validationErrors.teacherName ? 'border-red-300 focus:border-red-500' : 'border-slate-800 focus:border-orange-500'}`}
                />
                {validationErrors.teacherName && <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">{validationErrors.teacherName}</p>}
              </div>

              <div className="space-y-3">
                <label htmlFor="teacherNIP" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <FileText size={14} /> NIP Guru (Opsional)
                </label>
                <input
                  type="text"
                  id="teacherNIP"
                  value={teacherNIP}
                  onChange={handleInputChange(setTeacherNIP, 'teacherNIP')}
                  placeholder="Nomor Induk Pegawai"
                  className="w-full bg-transparent border-b-2 border-slate-800 py-3 text-slate-200 font-medium placeholder-slate-700 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-3">
                <label htmlFor="principalName" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <ShieldCheck size={14} /> Nama Kepala Sekolah
                </label>
                <input
                  type="text"
                  id="principalName"
                  value={principalName}
                  onChange={handleInputChange(setPrincipalName, 'principalName')}
                  placeholder="Nama Lengkap & Gelar"
                  className={`w-full bg-transparent border-b-2 py-3 text-slate-200 font-medium placeholder-slate-700 focus:outline-none transition-colors ${validationErrors.principalName ? 'border-red-300 focus:border-red-500' : 'border-slate-800 focus:border-orange-500'}`}
                />
                {validationErrors.principalName && <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">{validationErrors.principalName}</p>}
              </div>

              <div className="space-y-3">
                <label htmlFor="principalNIP" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2">
                  <FileText size={14} /> NIP Kepala (Opsional)
                </label>
                <input
                  type="text"
                  id="principalNIP"
                  value={principalNIP}
                  onChange={handleInputChange(setPrincipalNIP, 'principalNIP')}
                  placeholder="Nomor Induk Pegawai"
                  className="w-full bg-transparent border-b-2 border-slate-800 py-3 text-slate-200 font-medium placeholder-slate-700 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="pt-8">
              <button
                type="submit"
                disabled={!isFormValid || loading}
                className="w-full relative group overflow-hidden bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-[0.3em] text-sm py-5 rounded-2xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-orange-900/40 active:scale-[0.98]"
              >
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                         <Sparkles size={18} />
                      </motion.div>
                      Menyusun RPP...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Hasilkan RPP Interaktif
                    </>
                  )}
                </span>
              </button>
            </div>
          </form>
        </motion.div>

        <AnimatePresence>
          {(loading || error || result) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 rounded-[2rem] p-8 md:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-slate-800"
            >
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <LoadingSpinner />
                  <div className="text-center space-y-2">
                    <p className="text-white font-black uppercase tracking-widest text-xs">AI Sedang Bekerja</p>
                    <p className="text-slate-400 font-serif italic">"Menyelaraskan nilai-nilai spiritual dengan pedagogi modern..."</p>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl p-6 flex items-start gap-4">
                  <AlertCircle className="text-red-500 mt-1" />
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-widest text-xs">Akses Terhenti</p>
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-slate-800">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black tracking-tight text-white">Hasil Penyusunan</h3>
                      <p className="text-xs text-orange-500 font-bold uppercase tracking-widest">Siap untuk digunakan</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowPreview(true)}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700"
                        title="Pratinjau"
                      >
                        <Eye size={20} />
                      </button>
                      <button
                        onClick={() => requestConfirm('word')}
                        className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-[10px] py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                      >
                        <FileText size={16} /> Word
                      </button>
                      <button
                        onClick={() => requestConfirm('pdf')}
                        className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest text-[10px] py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                      >
                        <Download size={16} /> PDF
                      </button>
                      <button
                        onClick={() => requestConfirm('drive')}
                        disabled={isUploadingDrive}
                        className="flex items-center gap-3 bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest text-[10px] py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-900/20 active:scale-95 disabled:opacity-50"
                      >
                        <Cloud size={16} /> {isUploadingDrive ? 'Proses...' : driveSuccess ? 'Sukses' : 'Drive'}
                      </button>
                    </div>
                  </div>

                  <div id="rpp-content" className="prose prose-invert max-w-none overflow-x-auto">
                    <Markdown remarkPlugins={[remarkGfm]}>{result}</Markdown>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="text-center space-y-6 pt-12">
          <div className="h-px w-24 bg-slate-800 mx-auto" />
          <p className="text-[9px] text-slate-500 font-serif italic max-w-xs mx-auto">Aplikasi ini dirancang untuk mendukung Guru Agama sebagai fasilitator pembelajaran yang inspiratif.</p>
          <p className="text-[10px] text-slate-400 font-sans uppercase tracking-[0.2em] font-black">aplikasi ini dikembangkan oleh Abdul Hadi_Sdn Luwuk Kejayan</p>
        </footer>
      </div>

      <PreviewModal />
      <ConfirmModal />
    </div>
  );
}
