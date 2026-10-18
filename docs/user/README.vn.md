# Hướng dẫn sử dụng Kumiyui
> [!note]
> Tôi ghét việc viết tài liệu hướng dẫn, nhưng LLM lại rất giỏi việc này, vì vậy tôi để nó tự viết.\
> Cảm ơn gemini-3 đã hỗ trợ biên soạn tài liệu này.

> [!note]
> Tài liệu tiếng Việt này được dịch bởi LLM (Gemini 3)

Cẩm nang này cung cấp các hướng dẫn chi tiết để tương tác với giao diện khung phần mềm (framework) Kumiyui, thực thi các lệnh runtime, quản lý các nút chuyển đổi tập lệnh (script toggles) và cấu hình các thiết lập ngay bên trong trình duyệt web của bạn.

---

## Kích hoạt hộp nhập lệnh (Command Prompt)

Giao diện điều khiển chính của Kumiyui là một hộp thoại nhập liệu dạng văn bản xuất hiện đè lên trang web hiện tại.

* **Phím tắt mặc định:** Nhấn tổ hợp phím **`Shift` + `:`** (ký tự dấu hai chấm) trên bàn phím của bạn.
* **Cơ chế bảo vệ trường nhập liệu:** Trình lắng nghe kích hoạt sẽ tự động tạm dừng hoạt động bất cứ khi nào con trỏ chuột của bạn đang tập trung (focus) bên trong một biểu mẫu nhập liệu (input form), thanh tìm kiếm, vùng nhập văn bản (textarea) hoặc bất kỳ đoạn văn bản nào có thể chỉnh sửa trong tài liệu. Cơ chế này giúp ngăn chặn việc hộp thoại tự động bật lên ngoài ý muốn khi bạn đang gõ văn bản bình thường.

![hình ảnh hộp nhập lệnh](./assets/popup_prompt_sample.png)

---

## Thực thi các câu lệnh

Khi hộp nhập lệnh xuất hiện, bạn có thể chạy các chức năng hoặc kiểm tra các tính năng của tập lệnh bằng cách nhập các từ khóa đã được đăng ký.

### Cấu trúc cú pháp lệnh
Các câu lệnh sử dụng mô hình phân tách bằng dấu cách tiêu chuẩn để truyền các tham số hoặc các biến sửa đổi:
```text
command_name [argument_1] [argument_2]
```

### Các lệnh tiện ích cốt lõi được tích hợp sẵn

| Từ khóa lệnh | Phím tắt thay thế | Hành vi và Mục đích |
| :--- | :--- | :--- |
| **`help`** | `h`, `tasukete`, `cmd` | Xuất một bảng mục lục được cấu trúc rõ ràng vào bảng điều khiển (console) của trình duyệt, liệt kê tất cả các lệnh đang hoạt động, tên và mô tả chi tiết của chúng. |
| **`kumiyui.console`** | `kumiyui!c`, `kumiyui:c` | Thay đổi trỏ trỏ thuộc tính để chuyển đổi trạng thái hiển thị/ẩn của bảng điều khiển đồ họa giao diện trực quan (`DropInConsole`) trên màn hình. |
| **`kumiyui.disabledevtoolhelp`** | — | Triệt tiêu các thông báo nhắc nhở cảnh báo tự động của trình duyệt (vốn yêu cầu người dùng mở công cụ developer tool mỗi khi thực hiện chuỗi lệnh `help`). |

Từ terminal tích hợp sẵn (`DropInConsole`):

![kết quả bảng trợ giúp trên console](./assets/kumiyui_console_help_command.png)

Từ công cụ Devtool của trình duyệt:

![kết quả bảng trợ giúp trên devtool trình duyệt](./assets/browser_devtool_output.png)

---

## Quản lý các tính năng chuyển đổi (Feature Toggles)

Một số câu lệnh hoạt động như các công tắc đóng/mở (boolean switches) để bật hoặc tắt các cấu hình hoặc tập lệnh cụ thể một cách liên tục và lâu dài.

1. **Gọi lệnh trực tiếp:** Nhập một lệnh có chức năng chuyển đổi trực tiếp vào hộp nhập lệnh sẽ tự động đảo ngược trạng thái nhị phân của nó (ví dụ: chuyển từ trạng thái đang hoạt động sang không hoạt động).
2. **Menu của tiện ích mở rộng trình duyệt:** Khi chạy bên trong một trình quản lý userscript (chẳng hạn như Tampermonkey hoặc Violentmonkey), các công tắc này sẽ được ánh xạ trực tiếp vào bảng menu thả xuống chính của tiện ích mở rộng. Các tính năng sẽ hiển thị dưới dạng `<command>: enabled` (đã bật) hoặc `<command>: disabled` (đã tắt) và có thể được nhấp chuột để thay đổi giá trị ngay lập tức.
3. **Lưu trữ cấu hình vĩnh viễn:** Các lựa chọn cấu hình sẽ được ghi lại ngay lập tức vào lớp cơ sở dữ liệu lưu trữ. Các thiết lập ưu tiên của bạn sẽ được tự động giữ lại qua các lần tải lại trang (refresh) và các phiên làm việc tiếp theo của trình duyệt.

![giao diện tiện ích mở rộng userscript hiển thị trạng thái kích hoạt](./assets/tampermonkey_menu_toggle.png)

---

## Điều hướng trên thiết bị di động và màn hình cảm ứng

Trên các môi trường trình duyệt di động hoặc máy tính bảng màn hình cảm ứng (nơi không có bàn phím vật lý), Kumiyui sẽ tự động chèn một giao diện tiện ích trực quan có khả năng phản hồi linh hoạt với phần cứng.

* **Biểu tượng hành động nổi (Floating Action Icon):** Một biểu tượng hình tròn sẽ tự động hiển thị ở góc dưới bên phải của giao diện khung nhìn (viewport) khi hệ thống phát hiện các sự kiện chạm/con trỏ cảm ứng (touch pointer events).
* **Mở giao diện:** Chạm vào nút đồ họa nổi này sẽ mở hộp nhập lệnh văn bản ngay lập tức, tái tạo chính xác chức năng của phím tắt trên bàn phím.
* **Thay đổi vị trí:** Để tránh che khuất tầm nhìn hoặc các liên kết trên trang web, hãy nhấn giữ và vuốt biểu tượng để di chuyển tọa độ của nó đến bất kỳ vị trí nào dọc theo ranh giới màn hình hiển thị.

![mobile_toggle_1](./assets/mobile_toggle_1.png)

Bạn có thể nhìn thấy nó một cách rõ ràng tại đây:

![mobile_toggle_2](./assets/mobile_toggle_2.png)

---

## Ghi nhận đóng góp (Credits)
* **kumiyuki:** Tác giả chính, kiến trúc sư trưởng và là nhà phát triển duy nhất của framework Kumiyui. Chịu trách nhiệm thiết kế và triển khai toàn bộ cấu trúc mã nguồn bên dưới, tối ưu hóa bộ nhớ, cấu hình môi trường và các đường ống (pipelines) hook phục vụ kỹ thuật đảo ngược (đóng góp 90% khối lượng phát triển dự án).
* **Gemini (Google):** Trợ lý trí tuệ nhân tạo (AI) cộng tác, được sử dụng để xây dựng cấu trúc, tinh chỉnh ngôn ngữ và tạo ra các tệp mẫu tài liệu hướng dẫn bằng markdown (đóng góp 10% cho khâu thiết kế tài liệu).